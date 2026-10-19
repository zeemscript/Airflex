/**
 * fraudDetection.redis.test.ts
 *
 * Integration test verifying that velocity counts persist across simulated
 * process restarts using a Redis instance (issue #251).
 */

import net from "net";
import { FraudDetectionService } from "./fraudDetection";
import { cache } from "./cache";
import pool from "../db";

jest.mock("../db", () => ({
  query: jest.fn(),
}));

describe("FraudDetectionService Redis persistence across process restart", () => {
  let server: net.Server;
  let port: number;
  const store = new Map<string, string>();

  beforeAll((done) => {
    // Spin up an in-process TCP server that speaks Redis RESP protocol
    server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        while (buf.includes("\r\n")) {
          if (buf.startsWith("*1\r\n$4\r\nPING\r\n")) {
            socket.write("+PONG\r\n");
            buf = buf.slice("*1\r\n$4\r\nPING\r\n".length);
          } else if (buf.includes("SET")) {
            // Match RESP SET command: *5\r\n$3\r\nSET\r\n$<klen>\r\n<key>\r\n$<vlen>\r\n<val>\r\n$2\r\nEX\r\n...
            const lines = buf.split("\r\n");
            if (lines.length >= 7) {
              const key = lines[4];
              const val = lines[6];
              if (key && val) {
                store.set(key, val);
              }
              socket.write("+OK\r\n");
              buf = "";
            } else {
              break;
            }
          } else if (buf.includes("GET")) {
            // Match RESP GET command: *2\r\n$3\r\nGET\r\n$<klen>\r\n<key>\r\n
            const lines = buf.split("\r\n");
            if (lines.length >= 5) {
              const key = lines[4];
              const val = key ? store.get(key) : undefined;
              if (val !== undefined) {
                socket.write(`$${Buffer.byteLength(val)}\r\n${val}\r\n`);
              } else {
                socket.write("$-1\r\n");
              }
              buf = "";
            } else {
              break;
            }
          } else {
            break;
          }
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      port = addr.port;
      process.env["REDIS_URL"] = `redis://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    cache.disconnect();
    server.close(done);
  });

  it("persists velocity count across cache client disconnection and reconnection (process restart)", async () => {
    // Connect initial client
    await cache.checkReady();

    const userId = "persistent-user-456";
    const action = "trade_creation";

    // 1st request before restart
    const res1 = await FraudDetectionService.checkVelocity(userId, action);
    expect(res1.allowed).toBe(true);

    // Verify key exists in the backing store with count 1
    const stored1 = store.get(`velocity:${action}:${userId}`);
    expect(stored1).toBeDefined();
    expect(JSON.parse(stored1!).count).toBe(1);

    // 2nd request before restart
    const res2 = await FraudDetectionService.checkVelocity(userId, action);
    expect(res2.allowed).toBe(true);
    const stored2 = store.get(`velocity:${action}:${userId}`);
    expect(JSON.parse(stored2!).count).toBe(2);

    // --- SIMULATE PROCESS RESTART ---
    // Disconnect cache client completely (simulating process exit and new boot)
    cache.disconnect();

    // Reconnect as a new process instance would on startup
    await cache.checkReady();

    // 3rd request after restart: should pick up existing count (2) from Redis and increment to 3
    const res3 = await FraudDetectionService.checkVelocity(userId, action);
    expect(res3.allowed).toBe(true);

    const stored3 = store.get(`velocity:${action}:${userId}`);
    expect(JSON.parse(stored3!).count).toBe(3);
  });
});
