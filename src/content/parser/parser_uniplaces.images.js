(function () {
  "use strict";
  try {
    async function saveImagesAction(opts) {
      const btn = opts && opts.button ? opts.button : null;
      const modal = document.querySelector("div.sc-1t6jsoh-0.dUeFQx.photos-modal") || document.querySelector("div.photos-modal");
      const gallery = (modal && modal.querySelector("div.sc-16mjnzn-0.cBPfVX")) || document.querySelector("div.sc-16mjnzn-0.cBPfVX");
      if (!gallery) {
        if (btn) btn.textContent = "no gallery";
        return;
      }
      const firstDiv = Array.from(gallery.children).find((n) => n && n.tagName && n.tagName.toLowerCase() === "div");
      const roomLabel = firstDiv && firstDiv.id ? firstDiv.id.trim() : firstDiv ? firstDiv.getAttribute("id") || "" : "room";
      const roomId = (window.elh_helpers && window.elh_helpers.parseRoomIdFromPath) ? window.elh_helpers.parseRoomIdFromPath() : 'unknown-id';
      const urls = (window.elh_helpers && window.elh_helpers.collectImageUrlsFromRoomDiv) ? window.elh_helpers.collectImageUrlsFromRoomDiv(firstDiv) : [];
      if (!urls.length) {
        if (btn) btn.textContent = "no images";
        return;
      }
      let done = 0;
      if (btn) btn.textContent = `saving ${done}/${urls.length}`;
      for (const u of urls) {
        const url = u;
        const orig = (window.elh_helpers && window.elh_helpers.filenameFromUrl) ? window.elh_helpers.filenameFromUrl(url) : `img-${Date.now()}.jpg`;
        const safeLabel = String(roomLabel || "room").replace(/[\\/]+/g, "_");
        const safeOrig = String(orig).replace(/[\\/]+/g, "_");
        const targetName = `${safeLabel}-${safeOrig}`;
        const reqFilename = `${roomId}/${targetName}`;
        const onDone = () => {
          done++;
          if (btn) btn.textContent = `saving ${done}/${urls.length}`;
          if (done === urls.length && btn) btn.textContent = "saved";
        };
        const sent = (window.elh_helpers && window.elh_helpers.requestBackgroundDownload) ? window.elh_helpers.requestBackgroundDownload(url, reqFilename, (err) => {
          if (err && window.elh_helpers && window.elh_helpers.fallbackAnchorDownload) window.elh_helpers.fallbackAnchorDownload(url, `${roomId}-${targetName}`);
          onDone();
        }) : false;
        if (!sent) {
          if (window.elh_helpers && window.elh_helpers.fallbackAnchorDownload) window.elh_helpers.fallbackAnchorDownload(url, `${roomId}-${targetName}`);
          onDone();
        }
      }
    }

    // expose save images action
    window.elh_saveImgsAction = saveImagesAction;

    // save flat images (all except first section)
    async function saveFlatImagesAction(opts) {
      const btn = opts && opts.button ? opts.button : null;
      const modal = document.querySelector("div.sc-1t6jsoh-0.dUeFQx.photos-modal") || document.querySelector("div.photos-modal");
      const gallery = (modal && modal.querySelector("div.sc-16mjnzn-0.cBPfVX")) || document.querySelector("div.sc-16mjnzn-0.cBPfVX");
      if (!gallery) {
        if (btn) btn.textContent = "no gallery";
        return;
      }
      const children = Array.from(gallery.children).filter((n) => n && n.tagName && n.tagName.toLowerCase() === "div");
      if (!children.length) {
        if (btn) btn.textContent = "no images";
        return;
      }
      // skip the first section
      const sections = children.slice(1);
      // collect urls from remaining sections
      const urls = [];
      for (const sec of sections) {
        const secUrls = (window.elh_helpers && window.elh_helpers.collectImageUrlsFromRoomDiv) ? window.elh_helpers.collectImageUrlsFromRoomDiv(sec) : [];
        for (const u of secUrls) urls.push(u);
      }
      if (!urls.length) {
        if (btn) btn.textContent = "no images";
        return;
      }
      const firstDiv = children[0] || children[0];
      const roomLabel = firstDiv && firstDiv.id ? firstDiv.id.trim() : firstDiv ? firstDiv.getAttribute("id") || "room" : "room";
      const roomId = (window.elh_helpers && window.elh_helpers.parseRoomIdFromPath) ? window.elh_helpers.parseRoomIdFromPath() : 'unknown-id';
      let done = 0;
      if (btn) btn.textContent = `saving ${done}/${urls.length}`;
      for (const u of urls) {
        const url = u;
        const orig = (window.elh_helpers && window.elh_helpers.filenameFromUrl) ? window.elh_helpers.filenameFromUrl(url) : `img-${Date.now()}.jpg`;
        const safeLabel = String(roomLabel || "room").replace(/[\\/]+/g, "_");
        const safeOrig = String(orig).replace(/[\\/]+/g, "_");
        const targetName = `${safeLabel}-${safeOrig}`;
        const reqFilename = `${roomId} - flat/${targetName}`;
        const onDone = () => {
          done++;
          if (btn) btn.textContent = `saving ${done}/${urls.length}`;
          if (done === urls.length && btn) btn.textContent = "saved";
        };
        const sent = (window.elh_helpers && window.elh_helpers.requestBackgroundDownload) ? window.elh_helpers.requestBackgroundDownload(url, reqFilename, (err) => {
          if (err && window.elh_helpers && window.elh_helpers.fallbackAnchorDownload) window.elh_helpers.fallbackAnchorDownload(url, `${roomId}-${targetName}`);
          onDone();
        }) : false;
        if (!sent) {
          if (window.elh_helpers && window.elh_helpers.fallbackAnchorDownload) window.elh_helpers.fallbackAnchorDownload(url, `${roomId}-${targetName}`);
          onDone();
        }
      }
    }

    // expose save flat images action
    window.elh_saveFlatImgsAction = saveFlatImagesAction;
  } catch (err) {
    console.error('[ELH-helper] [parser_uniplaces.images] parser_uniplaces.images error', err);
  }
})();
