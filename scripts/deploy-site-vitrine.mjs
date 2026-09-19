import { promises as fs } from "node:fs";
import path from "node:path";

const proxyUrl = process.env.VITRINE_DEPLOY_PROXY;
if (!proxyUrl) throw new Error("VITRINE_DEPLOY_PROXY is missing");

const parsedProxy = new URL(proxyUrl);
if (
  parsedProxy.protocol !== "https:" ||
  parsedProxy.hostname !== "netlify-mcp.netlify.app" ||
  !parsedProxy.pathname.startsWith("/proxy/")
) {
  throw new Error("VITRINE_DEPLOY_PROXY has an unexpected destination");
}

const sourceDir = path.resolve(process.cwd(), "site-vitrine");
const skipNames = new Set([
  "node_modules",
  ".next",
  ".netlify",
  "coverage",
  "tmp",
  "test-results",
  "playwright-report"
]);
const skipFiles = new Set([".env"]);

async function collectFiles(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];

  for (const entry of entries) {
    if (skipNames.has(entry.name) || skipFiles.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = prefix ? \`\${prefix}/\${entry.name}\` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(abs, rel)));
    } else if (entry.isFile()) {
      files.push({ name: rel.replaceAll("\\\\", "/"), data: await fs.readFile(abs) });
    }
  }
  return files;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function buildStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = file.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

const files = await collectFiles(sourceDir);
if (files.length === 0) throw new Error("site-vitrine contains no deployable files");
if (!files.some((file) => file.name === "package.json")) {
  throw new Error("site-vitrine/package.json was not included");
}
if (!files.some((file) => file.name === "netlify.toml")) {
  throw new Error("site-vitrine/netlify.toml was not included");
}

const zip = buildStoredZip(files);
const boundary = \`----NetlifyFormBoundary\${Date.now().toString(16)}\`;
const opening = Buffer.from(
  \`--\${boundary}\\r\\n\` +
    'Content-Disposition: form-data; name="zip"; filename="site-vitrine.zip"\\r\\n' +
    "Content-Type: application/zip\\r\\n\\r\\n"
);
const closing = Buffer.from(\`\\r\\n--\${boundary}--\\r\\n\`);
const body = Buffer.concat([opening, zip, closing]);

const response = await fetch(proxyUrl, {
  method: "POST",
  headers: {
    "Content-Type": \`multipart/form-data; boundary=\${boundary}\`,
    "Content-Length": String(body.length),
    "User-Agent": "netlify-mcp"
  },
  body
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(
    \`Target Netlify build request failed: \${response.status} \${response.statusText}: \${responseText.slice(0, 1000)}\`
  );
}

let deployData;
try {
  deployData = JSON.parse(responseText);
} catch {
  deployData = responseText;
}
if (Array.isArray(deployData)) deployData = deployData[0];

console.log(JSON.stringify({
  target: "generation-capable-vitrine",
  files: files.length,
  zipBytes: zip.length,
  deployId: deployData?.deploy_id ?? null,
  buildId: deployData?.id ?? null
}));
