// Xbox 360 Dashboard Enhanced Script
// ⚡ Offline + Online Persistent Image & Video Support (localStorage + IndexedDB)

(function () {
  // --------------------------
  // CONSTANTS & STATE
  // --------------------------
  const storedImagesKey = "xboxTileImages";
  const storedVideosKey = "xboxTileVideos";
  const storedLinksKey = "xboxTileLinks";
  let currentTile = null;

  const storedImages = JSON.parse(localStorage.getItem(storedImagesKey) || "{}");
  const storedVideos = JSON.parse(localStorage.getItem(storedVideosKey) || "{}");
  const storedLinks = JSON.parse(localStorage.getItem(storedLinksKey) || "{}");

  // --------------------------
  // INDEXEDDB SETUP (for large images)
  // --------------------------
  const DB_NAME = "XboxMediaDB";
  const DB_STORE = "mediaStore";
  let db = null;

  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = (e) => reject(e);
    });
  }

  async function saveToDB(key, data) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e);
    });
  }

  async function readFromDB(key) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async function deleteFromDB(key) {
    if (!db) await initDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
  }

  // --------------------------
  // TILE INITIALIZATION
  // --------------------------
  function initializeTiles() {
    document.querySelectorAll(".tile-item").forEach((tile, idx) => {
      if (!tile.dataset.tileId) {
        const panel = tile.closest(".global-panel-list-item");
        const pid = panel ? panel.id : "panel";
        tile.dataset.tileId = `${pid}_tile_${idx}`;
      }
      if (!tile.hasAttribute("tabindex")) tile.setAttribute("tabindex", idx + 1);
    });
  }

  async function loadStoredMedia() {
    // Load Images (localStorage + IndexedDB fallback)
    for (const id in storedImages) {
      const t = document.querySelector(`[data-tile-id="${id}"]`);
      if (t) {
        if (storedImages[id] === "DB") {
          const dbData = await readFromDB(id);
          if (dbData) applyImageToTile(t, dbData);
        } else applyImageToTile(t, storedImages[id]);
      }
    }

    // Load Videos
    for (const id in storedVideos) {
      const t = document.querySelector(`[data-tile-id="${id}"]`);
      if (t) {
        t.dataset.video = storedVideos[id];
        addVideoBadge(t);
      }
    }

    // Load Links
    for (const id in storedLinks) {
      const t = document.querySelector(`[data-tile-id="${id}"]`);
      if (t) t.dataset.link = storedLinks[id];
    }
  }

  function applyImageToTile(tile, dataUrl) {
    tile.style.backgroundImage = `url(${dataUrl})`;
    tile.style.backgroundSize = "cover";
    tile.style.backgroundPosition = "center";
    tile.style.backgroundColor = "transparent";
  }

  function addVideoBadge(tile) {
    if (tile.querySelector(".video-play-badge")) return;
    const badge = document.createElement("div");
    badge.className = "video-play-badge";
    badge.innerHTML = "▶";
    badge.style.cssText =
      "position:absolute;bottom:8%;left:8%;width:50px;height:50px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;display:flex;align-items:center;justify-content:center;font-size:20px;";
    tile.style.position = "relative";
    tile.appendChild(badge);
  }

  // --------------------------
  // CONTEXT MENU
  // --------------------------
  function showContextMenu(x, y, tile) {
    hideContextMenu();
    currentTile = tile;

    const menu = document.createElement("div");
    menu.id = "tileContextMenu";
    menu.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;z-index:10000;background:#2c2c2c;border:1px solid #555;border-radius:6px;min-width:200px;box-shadow:0 4px 15px rgba(0,0,0,0.6);`;
    const items = [
      { text: "Upload Image / Video", fn: showUploadModal },
      { text: "Set Image from Gallery", fn: showImageGallery },
      { text: "Remove Media", fn: removeTileMedia },
      { text: "Link via URL / Website", fn: uploadViaURL },
    ];
    items.forEach((it) => {
      const el = document.createElement("div");
      el.textContent = it.text;
      el.style.cssText =
        "padding:10px 14px;color:white;cursor:pointer;font-family:Exo,sans-serif;";
      el.onmouseover = () => (el.style.background = "#75bb3e");
      el.onmouseout = () => (el.style.background = "transparent");
      el.onclick = () => {
        it.fn();
        hideContextMenu();
      };
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
  }

  function hideContextMenu() {
    document.getElementById("tileContextMenu")?.remove();
  }

  // --------------------------
  // UPLOAD HANDLING
  // --------------------------
  function showUploadModal() {
    const modal = document.getElementById("imageUploadModal");
    if (!modal) return alert("Upload modal not found.");
    const input = document.getElementById("imageUploadInput");
    if (input) {
      input.accept = "image/*,video/*";
      input.value = "";
    }
    modal.style.display = "flex";
  }

  async function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target.result;
      const id = currentTile.dataset.tileId;
      if (file.type.startsWith("image/")) {
        if (file.size > 4.5 * 1024 * 1024) {
          await saveToDB(id, data);
          storedImages[id] = "DB";
        } else {
          storedImages[id] = data;
        }
        localStorage.setItem(storedImagesKey, JSON.stringify(storedImages));
        applyImageToTile(currentTile, data);
      } else if (file.type.startsWith("video/")) {
        storedVideos[id] = data;
        localStorage.setItem(storedVideosKey, JSON.stringify(storedVideos));
        currentTile.dataset.video = data;
        addVideoBadge(currentTile);
      } else {
        alert("Unsupported file type.");
      }
    };
    reader.readAsDataURL(file);
  }

  function removeTileMedia() {
    if (!currentTile) return;
    const id = currentTile.dataset.tileId;
    delete storedImages[id];
    delete storedVideos[id];
    delete storedLinks[id];
    localStorage.setItem(storedImagesKey, JSON.stringify(storedImages));
    localStorage.setItem(storedVideosKey, JSON.stringify(storedVideos));
    localStorage.setItem(storedLinksKey, JSON.stringify(storedLinks));
    deleteFromDB(id);
    currentTile.style.backgroundImage = "";
    currentTile.style.backgroundColor = "#75bb3e";
    const badge = currentTile.querySelector(".video-play-badge");
    if (badge) badge.remove();
  }

  // --------------------------
  // URL LINK SUPPORT
  // --------------------------
  function uploadViaURL() {
    if (!currentTile) return;
    const input = prompt("Enter Image/Video URL or Website:");
    if (!input) return;
    const lower = input.toLowerCase();
    const id = currentTile.dataset.tileId;

    if (/\.(jpg|jpeg|png|gif|webp|bmp|jfif|heic)$/.test(lower)) {
      storedImages[id] = input;
      localStorage.setItem(storedImagesKey, JSON.stringify(storedImages));
      applyImageToTile(currentTile, input);
    } else if (/\.(mp4|webm|ogg|mov|m4v)$/.test(lower)) {
      storedVideos[id] = input;
      localStorage.setItem(storedVideosKey, JSON.stringify(storedVideos));
      currentTile.dataset.video = input;
      addVideoBadge(currentTile);
    } else if (input.startsWith("http")) {
      storedLinks[id] = input;
      localStorage.setItem(storedLinksKey, JSON.stringify(storedLinks));
      currentTile.dataset.link = input;
      alert("Website linked.");
    } else {
      alert("Invalid URL format.");
    }
  }

  // --------------------------
  // GALLERY
  // --------------------------
  function showImageGallery() {
    const galleryModal = document.getElementById("imageGalleryModal");
    if (!galleryModal) return alert("Gallery modal not found.");
    const galleryGrid = document.getElementById("galleryGrid");
    galleryGrid.innerHTML = "";

    for (const id in storedImages) {
      const div = document.createElement("div");
      div.style.cssText = `
        background-image:url(${storedImages[id]});
        background-size:cover;background-position:center;
        aspect-ratio:1;border-radius:6px;cursor:pointer;border:2px solid transparent;
      `;
      div.onclick = () => {
        applyImageToTile(currentTile, storedImages[id]);
        galleryModal.style.display = "none";
      };
      galleryGrid.appendChild(div);
    }

    galleryModal.style.display = "block";
  }

  // --------------------------
  // EVENT LISTENERS
  // --------------------------
  document.addEventListener("contextmenu", (e) => {
    const t = e.target.closest(".tile-item");
    if (!t) return;
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, t);
  });

  document.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile-item");
    const insideMenu = e.target.closest("#tileContextMenu");
    if (insideMenu) return;
    hideContextMenu();

    if (tile) {
      const vid = tile.dataset.video;
      if (vid) {
        openVideoModal(vid);
        return;
      }
      const link = tile.dataset.link;
      if (link) {
        window.open(link, "_blank");
        return;
      }
      tile.style.backgroundColor = "#3a6bba";
      setTimeout(() => (tile.style.backgroundColor = "#75bb3e"), 300);
    }
  });

  const confirmBtn = document.getElementById("confirmUpload");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      const input = document.getElementById("imageUploadInput");
      if (input && input.files.length) handleFileUpload(input.files[0]);
      document.getElementById("imageUploadModal").style.display = "none";
    });
  }

  const cancelBtn = document.getElementById("cancelUpload");
  if (cancelBtn)
    cancelBtn.addEventListener("click", () => {
      document.getElementById("imageUploadModal").style.display = "none";
    });

  const closeGallery = document.getElementById("closeGallery");
  if (closeGallery)
    closeGallery.addEventListener("click", () => {
      document.getElementById("imageGalleryModal").style.display = "none";
    });

  const uploadNewImage = document.getElementById("uploadNewImage");
  if (uploadNewImage)
    uploadNewImage.addEventListener("click", () => showUploadModal());

  // --------------------------
  // VIDEO MODAL
  // --------------------------
  function ensureVideoModal() {
    if (document.getElementById("videoModal")) return;
    const modal = document.createElement("div");
    modal.id = "videoModal";
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.95);display:none;align-items:center;justify-content:center;z-index:9999;";
    modal.innerHTML = `
      <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <button id="videoModalClose" style="position:absolute;top:20px;right:20px;padding:8px 14px;background:#222;color:#fff;border:none;border-radius:6px;">Close</button>
        <video id="videoModalPlayer" controls playsinline webkit-playsinline style="max-width:100%;max-height:100%;"></video>
      </div>`;
    document.body.appendChild(modal);

    document
      .getElementById("videoModalClose")
      .addEventListener("click", closeVideoModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeVideoModal();
    });
  }

  function openVideoModal(src) {
    ensureVideoModal();
    const modal = document.getElementById("videoModal");
    const player = document.getElementById("videoModalPlayer");
    player.src = src;
    modal.style.display = "flex";
    player.play().catch(() => {});
  }

  function closeVideoModal() {
    const modal = document.getElementById("videoModal");
    const player = document.getElementById("videoModalPlayer");
    if (player) player.pause();
    modal.style.display = "none";
  }

  // --------------------------
  // INIT
  // --------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await initDB();
    initializeTiles();
    await loadStoredMedia();
    ensureVideoModal();
  });
})();    
