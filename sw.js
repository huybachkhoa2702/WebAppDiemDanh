/* Service worker: lưu trang vào bộ nhớ máy để mở được khi không có mạng.
 * Mỗi lần sửa index.html hoặc file khác, đổi số phiên bản CACHE bên dưới (v1 -> v2...). */
const CACHE = "diemdanh-v2";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Chỉ xử lý yêu cầu GET cùng nguồn. Lệnh gửi lên Apps Script (POST, khác nguồn) đi thẳng ra mạng.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    // Có sẵn trong máy thì dùng ngay, đồng thời tải bản mới ở nền cho lần mở sau.
    const refresh = fetch(req)
      .then((res) => { if (res && res.status === 200) { cache.put(req, res.clone()).catch(() => {}); } return res; })
      .catch(() => null);

    if (cached) { e.waitUntil(refresh); return cached; }

    const res = await refresh;
    if (res) return res;
    if (req.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) return fallback;
    }
    return new Response("Không có mạng và chưa lưu trang này.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })());
});
