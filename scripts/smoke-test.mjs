import assert from "node:assert/strict";
import { once } from "node:events";
import { rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 4400 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;
const databasePath = join(projectRoot, "data", "smoke-test.db");
const smokeEnv = {
  ...process.env,
  DATABASE_URL: "file:../data/smoke-test.db",
  PORT: String(port),
  CORS_ORIGIN: "*",
  JWT_SECRET: process.env.JWT_SECRET ?? "smoke-test-secret-only",
};

let server;
let serverOutput = "";
let serverSpawnError;
let uploadedImagePath;

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: smokeEnv,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
    );
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body = options.body;
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${origin}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.form ?? body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  const expectedStatus =
    options.expectedStatus ?? (options.method === "POST" ? 201 : 200);

  assert.equal(
    response.status,
    expectedStatus,
    `${options.method ?? "GET"} ${path} returned ${response.status}: ${text}`,
  );

  return payload;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (serverSpawnError) {
      throw serverSpawnError;
    }

    if (server.exitCode !== null) {
      throw new Error(`Server exited during startup\n${serverOutput}`);
    }

    try {
      const response = await fetch(`${origin}/api/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Server did not start within 30 seconds\n${serverOutput}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    return;
  }

  server.kill();

  await Promise.race([
    once(server, "exit"),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)),
  ]).catch(() => undefined);

  if (server.exitCode === null) {
    server.kill("SIGKILL");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
}

async function removeSmokeArtifacts() {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    await rm(`${databasePath}${suffix}`, { force: true });
  }

  if (uploadedImagePath) {
    const uploadsDirectory = resolve(projectRoot, "uploads");
    const imagePath = resolve(projectRoot, uploadedImagePath);

    if (imagePath.startsWith(`${uploadsDirectory}${sep}`)) {
      await rm(imagePath, { force: true });
    }
  }
}

async function main() {
  await removeSmokeArtifacts();
  await writeFile(databasePath, "");
  runCommand("npx", ["prisma", "migrate", "deploy"]);
  runCommand("npm", ["run", "seed"]);

  server = spawn(process.execPath, ["dist/main.js"], {
    cwd: projectRoot,
    env: smokeEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.on("error", (error) => {
    serverSpawnError = error;
    serverOutput += `${error.stack ?? error.message}\n`;
  });

  await waitForServer();

  const root = await request("/api");
  assert.equal(root.success, true);
  assert.equal(root.message, "Storage Management System API is running");
  assert.equal(root.data.name, "Storage Management System");
  assert.equal(root.data.status, "ok");
  assert.equal(root.data.version, "1.0.0");

  const health = await request("/api/health");
  assert.equal(health.success, true);
  assert.equal(health.message, "Backend health check passed");
  assert.equal(health.data.status, "ok");
  assert.equal(health.data.database, "connected");
  assert.equal(Number.isNaN(Date.parse(health.data.timestamp)), false);

  const corsPreflight = await fetch(`${origin}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://mobile-app.local",
      "Access-Control-Request-Method": "POST",
    },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(corsPreflight.status, 204);
  assert.equal(
    corsPreflight.headers.get("access-control-allow-origin"),
    "http://mobile-app.local",
  );

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "admin123" },
  });
  const token = login.data.accessToken;
  assert.ok(token);

  await request("/api/devices", { expectedStatus: 401 });
  await request("/api/auth/me", { token });

  const uniqueValue = `${Date.now()}-${process.pid}`;
  const createdDevice = await request("/api/devices", {
    method: "POST",
    token,
    body: {
      name: `Smoke Device ${uniqueValue}`,
      details: "Temporary end-to-end verification record",
    },
  });
  const deviceId = createdDevice.data.id;

  const updatedDevice = await request(`/api/devices/${deviceId}`, {
    method: "PATCH",
    token,
    body: { name: `Updated Smoke Device ${uniqueValue}` },
  });
  assert.equal(updatedDevice.data.name, `Updated Smoke Device ${uniqueValue}`);

  const devices = await request("/api/devices", { token });
  assert.ok(devices.data.some(({ id }) => id === deviceId));

  const imageForm = new FormData();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0cAAAAASUVORK5CYII=",
    "base64",
  );
  imageForm.append(
    "image",
    new Blob([png], { type: "image/png" }),
    "smoke.png",
  );
  const uploadedImage = await request(`/api/devices/${deviceId}/image`, {
    method: "POST",
    token,
    form: imageForm,
  });
  uploadedImagePath = uploadedImage.data.imagePath;
  assert.ok(uploadedImagePath.startsWith("uploads/devices/"));

  const servedImage = await fetch(`${origin}/${uploadedImagePath}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(servedImage.status, 200);

  const serialNumber = `SMOKE-SERIAL-${uniqueValue}`;
  await request(`/api/devices/${deviceId}/serials`, {
    method: "POST",
    token,
    body: { serialNumbers: ["   "] },
    expectedStatus: 400,
  });
  const serials = await request(`/api/devices/${deviceId}/serials`, {
    method: "POST",
    token,
    body: { serialNumbers: [serialNumber] },
  });
  const deviceItemId = serials.data[0].id;
  assert.equal(serials.data[0].status, "AVAILABLE");

  await request(`/api/devices/${deviceId}/serials`, {
    method: "POST",
    token,
    body: { serialNumbers: [serialNumber] },
    expectedStatus: 409,
  });
  await request(`/api/devices/${deviceId}/serials`, {
    method: "POST",
    token,
    body: { serialNumbers: [`${serialNumber}-DUP`, `${serialNumber}-DUP`] },
    expectedStatus: 400,
  });

  const firstAssignment = await request("/api/assignments", {
    method: "POST",
    token,
    body: {
      deviceItemId,
      receivedBy: "Smoke Test User",
      notes: "First assignment",
    },
  });
  assert.equal(firstAssignment.data.status, "ACTIVE");
  assert.equal(firstAssignment.data.deviceItem.status, "ASSIGNED");

  await request("/api/assignments", {
    method: "POST",
    token,
    body: { deviceItemId, receivedBy: "Duplicate Assignment" },
    expectedStatus: 409,
  });

  const returnedAssignment = await request(
    `/api/assignments/${firstAssignment.data.id}/return`,
    {
      method: "POST",
      token,
      body: { returnNotes: "Returned by smoke test" },
    },
  );
  assert.equal(returnedAssignment.data.status, "RETURNED");
  assert.ok(returnedAssignment.data.returnedAt);
  assert.equal(returnedAssignment.data.deviceItem.status, "AVAILABLE");

  await request(`/api/assignments/${firstAssignment.data.id}/return`, {
    method: "POST",
    token,
    body: {},
    expectedStatus: 400,
  });

  const availableItems = await request(`/api/devices/${deviceId}/serials`, {
    token,
  });
  assert.equal(availableItems.data[0].status, "AVAILABLE");

  const secondAssignment = await request("/api/assignments", {
    method: "POST",
    token,
    body: { deviceItemId, receivedBy: "Smoke Test Reassignment" },
  });
  assert.equal(secondAssignment.data.status, "ACTIVE");

  const activeAssignments = await request("/api/assignments?status=ACTIVE", {
    token,
  });
  assert.ok(
    activeAssignments.data.some(({ id }) => id === secondAssignment.data.id),
  );

  const returnedAssignments = await request(
    "/api/assignments?status=RETURNED",
    { token },
  );
  assert.ok(
    returnedAssignments.data.some(({ id }) => id === firstAssignment.data.id),
  );

  await request(`/api/assignments/${secondAssignment.data.id}`, { token });

  const deviceDetails = await request(`/api/devices/${deviceId}`, { token });
  assert.equal(
    deviceDetails.data.items[0].latestActiveAssignment.id,
    secondAssignment.data.id,
  );

  const history = await request(`/api/devices/${deviceId}/assignments`, {
    token,
  });
  assert.equal(history.data.deviceItems[0].assignments.length, 2);

  const summary = await request("/api/dashboard/summary", { token });
  assert.equal(summary.data.activeAssignmentsCount, 1);
  assert.equal(summary.data.returnedAssignmentsCount, 1);

  const recentAssignments = await request("/api/dashboard/recent-assignments", {
    token,
  });
  assert.ok(
    recentAssignments.data.some(({ id }) => id === secondAssignment.data.id),
  );

  console.log(
    "Smoke test passed: root, health, auth, devices, images, serials, assignments, returns, history, and dashboard.",
  );
}

let smokeFailed = false;

try {
  await main();
} catch (error) {
  smokeFailed = true;
  console.error(error);
  if (serverOutput) {
    console.error("\nServer output:\n", serverOutput);
  }
} finally {
  try {
    await stopServer();
  } catch (error) {
    smokeFailed = true;
    console.error("Failed to stop smoke-test server:", error);
  }

  try {
    await removeSmokeArtifacts();
  } catch (error) {
    smokeFailed = true;
    console.error("Failed to remove smoke-test artifacts:", error);
  }
}

if (smokeFailed) {
  process.exitCode = 1;
}
