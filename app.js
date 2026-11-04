/* =========================================================
   MovieFinder: TMDB API + điều hướng 4 mục + tìm kiếm + thể loại + liên hệ
   ========================================================= */
const API_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
const HERO_BASE = "https://image.tmdb.org/t/p/w1280";
 
const $ = (id) => document.getElementById(id);
let bangTheLoai = {};
 
// Mỗi khu vực hiển thị phim có 1 "ctx": lưới phim, chỗ hiện số lượng, hộp thông báo
const ctxHome = { grid: $("featuredGrid"), count: null, status: $("homeStatus") };
const ctxSearch = { grid: $("movieGrid"), count: $("resultCount"), status: $("statusBox") };
const ctxDetail = { status: $("detailStatus") };
const ctxGenre = { grid: $("genreGrid"), count: $("genreCount"), status: $("genreStatus") };
 
// ---- Gọi API (dùng chung cho mọi yêu cầu) ----
async function goiAPI(duongDan, thamSo = {}) {
  // Kiểm tra API Key trước khi gọi (không bao giờ in key ra thông báo)
  if (typeof TMDB_API_KEY === "undefined" || !TMDB_API_KEY || TMDB_API_KEY.includes("DAN_KEY")) {
    throw new Error("Chưa cấu hình API Key TMDB. Hãy mở file js/config.js và dán API Key (v3) vào.");
  }
  const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: "vi-VN", ...thamSo });
  const dieuKhien = new AbortController();
  const hen = setTimeout(() => dieuKhien.abort(), 15000); // quá 15 giây thì báo lỗi
  let res;
  try {
    res = await fetch(`${API_URL}${duongDan}?${params}`, { signal: dieuKhien.signal });
  } catch (loi) {
    // Lỗi cấp mạng: không có phản hồi nào từ TMDB (DNS, bị chặn, mất mạng, hết thời gian...)
    // Chỉ log đường dẫn, KHÔNG log URL vì URL chứa API Key
    console.error("[MovieFinder] Không kết nối được TMDB:", duongDan, loi.name, loi.message);
    if (loi.name === "AbortError") {
      throw new Error("TMDB phản hồi quá chậm (quá 15 giây). Vui lòng kiểm tra mạng rồi bấm “Thử lại”.");
    }
    throw new Error("Không kết nối được tới máy chủ TMDB (api.themoviedb.org). Nguyên nhân thường gặp: mất mạng, nhà mạng/DNS chặn TMDB, VPN hoặc tường lửa. Hãy thử đổi DNS (1.1.1.1 hoặc 8.8.8.8) hoặc bật VPN, rồi bấm “Thử lại”.");
  } finally {
    clearTimeout(hen);
  }
  if (res.status === 401) throw new Error("API Key không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại file js/config.js.");
  if (res.status === 404) throw new Error("Không tìm thấy dữ liệu yêu cầu (mã 404).");
  if (res.status === 429) throw new Error("Gửi quá nhiều yêu cầu tới TMDB (mã 429). Hãy đợi vài giây rồi thử lại.");
  if (!res.ok) throw new Error(`Máy chủ TMDB đang gặp sự cố (mã ${res.status}). Vui lòng thử lại sau.`);
  try {
    return await res.json();
  } catch {
    throw new Error("TMDB trả về dữ liệu không đọc được. Vui lòng thử lại.");
  }
}
 
// ---- Hàm tiện ích ----
const layNam = (ngay) => (ngay ? ngay.slice(0, 4) : "Chưa rõ");
const thoat = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
 
function hienThongBao(ctx, noiDung, loai = "", thuLai = null) {
  ctx.status.textContent = noiDung;
  ctx.status.className = "status-box " + loai;
  if (thuLai) {
    const nut = document.createElement("button");
    nut.type = "button";
    nut.className = "btn btn-accent btn-sm d-block mx-auto mt-3";
    nut.textContent = "Thử lại";
    nut.addEventListener("click", thuLai);
    ctx.status.appendChild(nut);
  }
}
const anThongBao = (ctx) => (ctx.status.className = "status-box d-none");
 
function tenTheLoai(ids = []) {
  const ten = ids.map((id) => bangTheLoai[id]).filter(Boolean);
  return ten.length ? ten.join(", ") : "Chưa rõ";
}
 
// ---- Vẽ danh sách phim (dùng chung cho Trang chủ, Tìm kiếm, Thể loại) ----
function hienThiPhim(danhSach, ctx, noiThem = false) {
  // Chỉ giữ phim có dữ liệu hợp lệ (có id và tên)
  danhSach = (Array.isArray(danhSach) ? danhSach : []).filter((p) => p && p.id && p.title);
  if (!noiThem) ctx.grid.innerHTML = "";
  if (danhSach.length === 0 && !noiThem) {
    hienThongBao(ctx, "Không tìm thấy phim nào. Hãy thử từ khóa hoặc bộ lọc khác.");
    if (ctx.count) ctx.count.textContent = "";
    return;
  }
  anThongBao(ctx);
 
  danhSach.forEach((phim) => {
    const coAnh = Boolean(phim.poster_path);
    const ten = thoat(phim.title);
    const theLoai = (phim.genre_ids || []).slice(0, 2).map((id) => bangTheLoai[id]).filter(Boolean).join(" · ");
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `
      <button class="movie-card" type="button" aria-label="Xem chi tiết ${ten}">
        <div class="poster" ${coAnh ? `style="background-image:url('${IMG_BASE}${phim.poster_path}')"` : ""}>
          ${coAnh ? "" : `<span class="poster-fallback">${ten}</span>`}
          <span class="rating-badge">★ ${(phim.vote_average || 0).toFixed(1)}</span>
        </div>
        <p class="movie-name">${ten}</p>
        <span class="movie-year">${layNam(phim.release_date)}</span>
        <span class="movie-genre">${thoat(theLoai)}</span>
      </button>`;
    col.querySelector(".movie-card").addEventListener("click", () => vaoChiTiet(phim.id));
    ctx.grid.appendChild(col);
  });
}
 
/* ================= CHI TIẾT PHIM (trang riêng: #movie-ID) ================= */
let idChiTiet = null, daVaoTuTrongApp = false, dangQuayLai = false, vitriCuon = 0;

// Biểu tượng nhỏ (SVG, màu theo chữ)
const bieuTuong = (noiDung, dac = false) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" ${dac ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${noiDung}</svg>`;
const ICON = {
  lich: bieuTuong('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  nhan: bieuTuong('<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>'),
  cau: bieuTuong('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  dongHo: bieuTuong('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  sao: bieuTuong('<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>', true),
};

const laSo = (n) => typeof n === "number" && Number.isFinite(n);
function dinhDangNgay(ngay) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngay || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function dinhDangThoiLuong(phut) {
  if (!laSo(phut) || phut <= 0) return "";
  const g = Math.floor(phut / 60), p = phut % 60;
  return g ? `${g} giờ ${p} phút` : `${p} phút`;
}
const dinhDangTien = (n) => (laSo(n) && n > 0 ? "$" + n.toLocaleString("en-US") : "");
function layPhanLoai(d) {
  const kq = d.release_dates?.results || [];
  for (const ma of ["VN", "US"]) {
    const q = kq.find((x) => x.iso_3166_1 === ma);
    const c = (q?.release_dates || []).map((r) => r.certification).find(Boolean);
    if (c) return { nhan: c, nguon: ma };
  }
  return null;
}
function tenNgonNgu(ma, duPhong) {
  try {
    const ten = new Intl.DisplayNames(["vi"], { type: "language" }).of(ma);
    if (ten && ten.toLowerCase() !== String(ma).toLowerCase()) return ten;
  } catch { /* trình duyệt cũ: dùng tên dự phòng */ }
  return duPhong || "";
}

function vaoChiTiet(id) {
  vitriCuon = window.scrollY;
  daVaoTuTrongApp = true;
  location.hash = "#movie-" + id;
}

function veChiTiet(d) {
  const ten = d.title || d.original_title || "Chưa rõ tên phim";
  const nam = d.release_date ? layNam(d.release_date) : "";
  const thoiLuong = dinhDangThoiLuong(d.runtime);
  const theLoai = (d.genres || []).map((g) => g && g.name).filter(Boolean);
  const diem = laSo(d.vote_average) ? d.vote_average : 0;
  const luot = laSo(d.vote_count) ? d.vote_count : 0;
  const coDiem = luot > 0 && diem > 0;
  const luotText = luot.toLocaleString("vi-VN");
  const phanLoai = layPhanLoai(d);

  // Poster
  const poster = $("dPoster");
  poster.style.backgroundImage = d.poster_path ? `url('${IMG_BASE}${d.poster_path}')` : "";
  poster.innerHTML = d.poster_path ? "" : `<span class="poster-fallback">${thoat(ten)}</span>`;

  // Trailer (giữ logic cũ: ưu tiên Trailer trên YouTube, không có thì lấy video YouTube bất kỳ)
  const videos = d.videos?.results || [];
  const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer") || videos.find((v) => v.site === "YouTube");
  $("dTrailer").innerHTML = trailer && trailer.key
    ? `<a class="btn btn-accent w-100" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}">▶ Xem trailer</a>`
    : `<p class="text-muted-2 text-center mb-0">Chưa có trailer cho phim này.</p>`;

  // Cột giữa
  $("dTitle").textContent = ten;
  const meta = [];
  meta.push(coDiem
    ? `<span class="detail-score"><span class="star">${ICON.sao}</span><strong>${diem.toFixed(1)}</strong><span class="text-muted-2">/10 · ${luotText} lượt đánh giá</span></span>`
    : `<span class="text-muted-2">Chưa có đánh giá</span>`);
  if (nam) meta.push(`<span>${thoat(nam)}</span>`);
  if (thoiLuong) meta.push(`<span>${thoat(thoiLuong)}</span>`);
  if (phanLoai) meta.push(`<span class="cert-badge" title="Phân loại độ tuổi (${thoat(phanLoai.nguon)})">${thoat(phanLoai.nhan)}</span>`);
  $("dMeta").innerHTML = meta.join("");
  $("dGenres").innerHTML = theLoai.map((t) => `<span class="chip">${thoat(t)}</span>`).join("");
  $("dOverview").textContent = d.overview || "Chưa có mô tả tiếng Việt cho phim này.";

  const daoDien = (d.credits?.crew || []).filter((c) => c && c.job === "Director").map((c) => c.name).filter(Boolean);
  const dienVien = (d.credits?.cast || []).slice(0, 8).map((c) => c && c.name).filter(Boolean);
  let ngonNgu = (d.spoken_languages || []).map((l) => tenNgonNgu(l.iso_639_1, l.english_name || l.name)).filter(Boolean);
  if (!ngonNgu.length && d.original_language) ngonNgu = [tenNgonNgu(d.original_language, d.original_language)];
  const hang = [
    ["Đạo diễn", daoDien.join(", ")],
    ["Diễn viên", dienVien.join(", ")],
    ["Ngôn ngữ", ngonNgu.join(", ")],
    ["Doanh thu", dinhDangTien(d.revenue)],
  ].filter(([, giaTri]) => giaTri); // không có dữ liệu thì ẩn dòng
  $("dInfo").innerHTML = hang.map(([nhan, giaTri]) => `<li><span class="lbl">${nhan}</span><span class="val">${thoat(giaTri)}</span></li>`).join("");

  // Cột phải: Thông tin thêm
  const quocGia = (d.production_countries || []).map((c) => c && c.name).filter(Boolean).join(", ");
  const mucThem = [
    [ICON.lich, "Ngày phát hành", dinhDangNgay(d.release_date)],
    [ICON.nhan, "Thể loại", theLoai.join(", ")],
    [ICON.cau, "Quốc gia sản xuất", quocGia],
    [ICON.dongHo, "Thời lượng", thoiLuong],
  ].filter(([, , giaTri]) => giaTri);
  const dong = mucThem.map(([icon, nhan, giaTri]) =>
    `<li><span class="ico">${icon}</span><span><span class="lbl">${nhan}</span><span class="val">${thoat(giaTri)}</span></span></li>`);
  dong.push(coDiem
    ? `<li class="rating-row"><span class="ico star">${ICON.sao}</span><span><span class="lbl">Điểm đánh giá</span><span class="val"><strong class="big">${diem.toFixed(1)}</strong> / 10</span><span class="lbl">${luotText} lượt đánh giá</span></span></li>`
    : `<li><span class="ico">${ICON.sao}</span><span><span class="lbl">Điểm đánh giá</span><span class="val">Chưa có đánh giá</span></span></li>`);
  $("dAside").innerHTML = dong.join("");
}

async function taiChiTiet(id) {
  idChiTiet = id;
  $("detailBody").classList.add("d-none");
  hienThongBao(ctxDetail, "Đang tải thông tin phim…");
  try {
    const d = await goiAPI(`/movie/${id}`, { append_to_response: "credits,videos,release_dates", include_video_language: "vi,en,null" });
    if (idChiTiet !== id) return; // người dùng đã chuyển sang phim/trang khác
    if (!d || !d.id) throw new Error("TMDB trả về dữ liệu phim không hợp lệ. Vui lòng thử lại.");
    veChiTiet(d);
    document.title = `${d.title || "Chi tiết phim"} – MovieFinder`;
    anThongBao(ctxDetail);
    $("detailBody").classList.remove("d-none");
  } catch (loi) {
    if (idChiTiet !== id) return;
    hienThongBao(ctxDetail, loi.message, "error", () => taiChiTiet(id));
  }
}
 
/* ================= TÌM KIẾM (dùng chung cho Trang chủ + Tìm kiếm nâng cao) ================= */
let trangTK = 1;
let daTaiTimKiem = false;
 
function layBoLoc() {
  return { theLoai: $("fGenre").value, tu: $("fFrom").value, den: $("fTo").value, diem: $("fRating").value };
}
 
async function chayTimKiem(them = false) {
  const tuKhoa = $("searchInput2").value.trim();
  const bl = layBoLoc();
  const ctx = ctxSearch;
  $("moreBtn").classList.add("d-none");
  if (!them) { trangTK = 1; ctx.grid.innerHTML = ""; ctx.count.textContent = ""; } else trangTK++;
  $("resultTitle").textContent = tuKhoa ? `Kết quả tìm kiếm cho “${tuKhoa}”` : "Tất cả phim";
  hienThongBao(ctx, "Đang tìm phim…");
 
  try {
    if (tuKhoa) {
      // Có từ khóa: /search/movie (3 trang), lọc phía trình duyệt vì API này không hỗ trợ bộ lọc
      const trang = await Promise.all([1, 2, 3].map((p) => goiAPI("/search/movie", { query: tuKhoa, page: p })));
      let ds = trang.flatMap((t) => t.results);
      if (bl.theLoai) ds = ds.filter((p) => (p.genre_ids || []).includes(Number(bl.theLoai)));
      if (bl.tu) ds = ds.filter((p) => p.release_date && Number(layNam(p.release_date)) >= Number(bl.tu));
      if (bl.den) ds = ds.filter((p) => p.release_date && Number(layNam(p.release_date)) <= Number(bl.den));
      if (bl.diem) ds = ds.filter((p) => (p.vote_average || 0) >= Number(bl.diem));
      hienThiPhim(ds, ctx);
      if (ds.length) ctx.count.textContent = `Có ${ds.length} kết quả`;
    } else {
      // Không từ khóa: /discover/movie (lọc ngay trên máy chủ TMDB)
      const tham = { sort_by: "popularity.desc", page: trangTK };
      if (bl.theLoai) tham.with_genres = bl.theLoai;
      if (bl.tu) tham["primary_release_date.gte"] = `${bl.tu}-01-01`;
      if (bl.den) tham["primary_release_date.lte"] = `${bl.den}-12-31`;
      if (bl.diem) { tham["vote_average.gte"] = bl.diem; tham["vote_count.gte"] = 50; }
      const data = await goiAPI("/discover/movie", tham);
      hienThiPhim(data.results, ctx, them);
      if (data.total_results) ctx.count.textContent = `Có ${data.total_results.toLocaleString("vi-VN")} kết quả`;
      $("moreBtn").classList.toggle("d-none", trangTK >= Math.min(data.total_pages, 500));
    }
  } catch (loi) {
    hienThongBao(ctx, loi.message, "error", () => { if (them) trangTK--; chayTimKiem(them); });
  }
}
 
// Điểm vào chung: từ ô tìm nhanh trang chủ, từ khóa gợi ý
function timTheoTuKhoa(tuKhoa) {
  $("searchInput2").value = tuKhoa;
  daTaiTimKiem = true;
  if (location.hash === "#search") chayTimKiem();
  else { location.hash = "#search"; chayTimKiem(); }
}
 
/* ================= THỂ LOẠI ================= */
let daTaiTheLoai = false, theLoaiHienTai = null, trangTL = 1;
 
async function taiTheLoai() {
  if (daTaiTheLoai) return;
  const ctx0 = { status: $("genreStatus0") };
  if (!Object.keys(bangTheLoai).length) {
    hienThongBao(ctx0, "Đang tải danh sách thể loại…");
    await taiDanhSachTheLoai();
    if (!Object.keys(bangTheLoai).length) {
      hienThongBao(ctx0, "Không tải được danh sách thể loại từ TMDB.", "error", taiTheLoai);
      return;
    }
  }
  anThongBao(ctx0);
  daTaiTheLoai = true;
  const box = $("genreCards");
  box.innerHTML = "";
  Object.entries(bangTheLoai).forEach(([id, ten]) => {
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `<button type="button" class="genre-card"><span>${thoat(ten)}</span><small>…</small></button>`;
    const btn = col.querySelector("button");
    btn.addEventListener("click", () => moTheLoai(id, ten));
    box.appendChild(col);
    // Lấy ảnh nền + số phim thật từ TMDB
    goiAPI("/discover/movie", { with_genres: id, sort_by: "popularity.desc" }).then((d) => {
      const bd = d.results.find((p) => p.backdrop_path);
      if (bd) btn.style.backgroundImage = `url('${BACKDROP_BASE}${bd.backdrop_path}')`;
      btn.querySelector("small").textContent = `${d.total_results.toLocaleString("vi-VN")} phim`;
    }).catch(() => (btn.querySelector("small").textContent = ""));
  });
}
 
async function taiPhimTheLoai(them = false) {
  if (!them) { trangTL = 1; ctxGenre.grid.innerHTML = ""; } else trangTL++;
  $("genreMore").classList.add("d-none");
  hienThongBao(ctxGenre, "Đang tải phim…");
  try {
    const d = await goiAPI("/discover/movie", { with_genres: theLoaiHienTai, sort_by: "popularity.desc", page: trangTL });
    hienThiPhim(d.results, ctxGenre, them);
    ctxGenre.count.textContent = `${d.total_results.toLocaleString("vi-VN")} phim`;
    $("genreMore").classList.toggle("d-none", trangTL >= Math.min(d.total_pages, 500));
  } catch (loi) {
    hienThongBao(ctxGenre, loi.message, "error", () => { if (them) trangTL--; taiPhimTheLoai(them); });
  }
}
 
function moTheLoai(id, ten) {
  theLoaiHienTai = id;
  $("genreTitle").textContent = ten;
  $("genreList").classList.add("d-none");
  $("genreDetail").classList.remove("d-none");
  taiPhimTheLoai();
}
 
/* ================= TRANG CHỦ ================= */
// Hình nền Hero: ghép tối đa 4 ảnh backdrop của phim nổi bật (lấy từ dữ liệu đã có, không gọi thêm API).
// Ảnh nào lỗi sẽ bị bỏ qua; nếu tất cả lỗi, Hero giữ nền gradient dự phòng trong CSS.
function datHinhNenHero(danhSach) {
  const box = $("heroBg");
  if (!box || !Array.isArray(danhSach)) return;
  box.innerHTML = "";
  danhSach.filter((p) => p && p.backdrop_path).slice(0, 4).forEach((p) => {
    const url = `${HERO_BASE}${p.backdrop_path}`;
    const img = new Image();
    img.onload = () => {
      const o = document.createElement("div");
      o.style.backgroundImage = `url('${url}')`;
      box.appendChild(o);
      requestAnimationFrame(() => o.classList.add("loaded"));
    };
    img.onerror = () => {}; // bỏ qua ảnh lỗi
    img.src = url;
  });
}

async function taiPhimNoiBat() {
  hienThongBao(ctxHome, "Đang tải danh sách phim…");
  try {
    const data = await goiAPI("/movie/popular");
    if (!data || !Array.isArray(data.results)) throw new Error("TMDB trả về dữ liệu không hợp lệ. Vui lòng thử lại.");
    hienThiPhim(data.results.slice(0, 10), ctxHome);
    datHinhNenHero(data.results);
  } catch (loi) {
    ctxHome.grid.innerHTML = "";
    hienThongBao(ctxHome, loi.message, "error", async () => {
      if (!Object.keys(bangTheLoai).length) await taiDanhSachTheLoai();
      taiPhimNoiBat();
    });
  }
}
 
/* ================= ĐIỀU HƯỚNG ================= */
const VIEWS = ["home", "search", "genres", "contact", "detail"];
const TIEU_DE_GOC = document.title;
let viewHienTai = null;
 
function dieuHuong() {
  const h = location.hash.replace("#", "");
  const mPhim = h.match(/^movie-(\d+)$/);
  const view = mPhim ? "detail" : VIEWS.includes(h) && h !== "detail" ? h : "home";
  const truoc = viewHienTai;
  viewHienTai = view;
  VIEWS.forEach((n) => $("view-" + n).classList.toggle("d-none", n !== view));
  document.querySelectorAll("[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  if (view !== "detail") {
    document.title = TIEU_DE_GOC;
    if (!dangQuayLai) daVaoTuTrongApp = false;
  }
  // Quay lại từ trang chi tiết: trả về đúng vị trí cuộn cũ
  window.scrollTo({ top: truoc === "detail" && view !== "detail" && dangQuayLai ? vitriCuon : 0, behavior: "instant" });
  dangQuayLai = false;
  bootstrap.Collapse.getOrCreateInstance($("menu"), { toggle: false }).hide();
  if (view === "search" && !daTaiTimKiem) { daTaiTimKiem = true; chayTimKiem(); }
  if (view === "genres") {
    taiTheLoai();
    if (truoc !== "detail") { // quay lại từ chi tiết thì giữ nguyên danh sách phim thể loại đang xem
      $("genreList").classList.remove("d-none");
      $("genreDetail").classList.add("d-none");
    }
  }
  if (view === "detail") {
    const id = Number(mPhim[1]);
    const dangHien = id === idChiTiet && !$("detailBody").classList.contains("d-none");
    if (!dangHien) taiChiTiet(id);
  }
}
 
/* ================= LIÊN HỆ ================= */
const truongLH = ["cName", "cEmail", "cTopic", "cMsg"];
const emailHopLe = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
 
function hienTrangThaiLH(noiDung, kieu) {
  const box = $("cStatus");
  box.textContent = noiDung;
  box.className = `alert alert-${kieu} mt-3`;
}
 
$("contactForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const loi = {
    cName: !$("cName").value.trim(),
    cEmail: !emailHopLe($("cEmail").value.trim()),
    cTopic: !$("cTopic").value,
    cMsg: $("cMsg").value.trim().length < 10,
  };
  truongLH.forEach((id) => $(id).classList.toggle("is-invalid", loi[id]));
  if (Object.values(loi).some(Boolean)) {
    hienTrangThaiLH("Vui lòng kiểm tra lại các trường bị đánh dấu.", "danger");
    return;
  }
  // Chưa cấu hình dịch vụ nhận tin nhắn => nói thật, không giả vờ đã gửi
  if (typeof FORM_ENDPOINT === "undefined" || !FORM_ENDPOINT) {
    hienTrangThaiLH("Dữ liệu hợp lệ, nhưng website CHƯA kết nối dịch vụ nhận tin nhắn nên tin nhắn chưa được gửi.", "warning");
    return;
  }
  hienTrangThaiLH("Đang gửi…", "info");
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: $("cName").value.trim(), email: $("cEmail").value.trim(), topic: $("cTopic").value, message: $("cMsg").value.trim() }),
    });
    if (!res.ok) throw new Error();
    hienTrangThaiLH("Đã gửi liên hệ. Cảm ơn bạn!", "success");
    e.target.reset();
  } catch {
    hienTrangThaiLH("Gửi thất bại. Vui lòng thử lại sau.", "danger");
  }
});
 
$("contactReset").addEventListener("click", () => {
  truongLH.forEach((id) => $(id).classList.remove("is-invalid"));
  $("cStatus").className = "d-none";
});
 
/* ================= SỰ KIỆN & KHỞI ĐỘNG ================= */
$("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const tuKhoa = $("searchInput").value.trim();
  if (!tuKhoa) { hienThongBao(ctxHome, "Vui lòng nhập tên phim cần tìm.", "error"); return; }
  timTheoTuKhoa(tuKhoa);
});
$("quickTags").addEventListener("click", (e) => {
  const q = e.target.dataset.q;
  if (q) { $("searchInput").value = q; timTheoTuKhoa(q); }
});
$("advForm").addEventListener("submit", (e) => { e.preventDefault(); chayTimKiem(); });
$("applyBtn").addEventListener("click", () => chayTimKiem());
$("resetBtn").addEventListener("click", () => {
  ["fGenre", "fFrom", "fTo", "fRating", "searchInput2"].forEach((id) => ($(id).value = ""));
  chayTimKiem();
});
$("detailBack").addEventListener("click", () => {
  if (daVaoTuTrongApp) { dangQuayLai = true; history.back(); } // về đúng trang trước đó
  else location.hash = "#home";                                 // mở link trực tiếp: về trang chủ
});
$("moreBtn").addEventListener("click", () => chayTimKiem(true));
$("genreMore").addEventListener("click", () => taiPhimTheLoai(true));
$("genreBack").addEventListener("click", () => {
  $("genreDetail").classList.add("d-none");
  $("genreList").classList.remove("d-none");
});
$("seeAll").addEventListener("click", () => { $("searchInput2").value = ""; daTaiTimKiem = false; });
window.addEventListener("hashchange", dieuHuong);
 
async function taiDanhSachTheLoai() {
  try {
    const data = await goiAPI("/genre/movie/list");
    if (!data || !Array.isArray(data.genres)) return;
    $("fGenre").length = 1; // giữ lại lựa chọn "Tất cả", tránh thêm trùng khi tải lại
    data.genres.forEach((g) => {
      bangTheLoai[g.id] = g.name;
      $("fGenre").add(new Option(g.name, g.id));
    });
  } catch (loi) {
    console.warn("[MovieFinder] Chưa tải được danh sách thể loại:", loi.message);
  }
}
 
async function khoiDong() {
  await taiDanhSachTheLoai(); // lỗi ở đây không chặn phần còn lại (hàm này không ném lỗi)
  dieuHuong();                // luôn chạy, kể cả khi API lỗi
  taiPhimNoiBat();            // lỗi (nếu có) hiện kèm nút "Thử lại"
}
khoiDong();