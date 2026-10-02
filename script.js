// AgriBridge — shared script (loaded by every page).
//
// This single bundle serves all pages. Each page-specific feature is wrapped in
// safeFeature() and begins with its own guard (an early `return` when the markup
// it needs is absent), so loading it on a page that doesn't use it is harmless.
// Every feature is registered in one DOMContentLoaded handler below (JS-02).
//
// Convention for new work: add a named safeFeature(...) block, check for the
// elements you need before touching them, and never share mutable state across
// features without going through module-level helpers (as the funnel does).

document.addEventListener("DOMContentLoaded", function () {

  // ===== Error isolation (JS-03) =====
  // Every feature below initialises inside its own guard. If one feature throws
  // (unexpected markup, a browser API that is unavailable, etc.) the error is
  // logged and contained, so the rest of the page's JavaScript still runs.
  function safeFeature(name, init) {
    try {
      init();
    } catch (error) {
      if (window.console && typeof window.console.error === 'function') {
        window.console.error('AgriBridge: "' + name + '" failed to initialise.', error);
      }
    }
  }

  // Honour the reduced-motion preference for behaviour CSS cannot control:
  // smooth scrolling and video autoplay in the lightbox (SEO-03).
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ===== Funnel state =====
  // The intended application form is kept in sessionStorage so it can be handed
  // off after the eligibility gate. Storage can be unavailable (private mode,
  // disabled storage, quota), so every access is guarded (FUN-03).
  var TARGET_URL_KEY = 'agribridgeTargetUrl';

  function safeStorageGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      // Storage unavailable: the gate still runs, the form is just not persisted.
    }
  }

  function safeStorageRemove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (e) {
      // Nothing to clear.
    }
  }

  // Attach the chosen destination to the form hand-off so it is not lost (FUN-01).
  function appendDestination(url, destination) {
    if (!destination) return url;
    try {
      var parsed = new URL(url);
      parsed.searchParams.set('destination', destination);
      return parsed.toString();
    } catch (e) {
      var separator = url.indexOf('?') === -1 ? '?' : '&';
      return url + separator + 'destination=' + encodeURIComponent(destination);
    }
  }

  // ===== Application cards (contact.html) =====
  // The anchors point at country-check.html so left-click, new-tab, modified-click
  // and JS-disabled users all pass through the eligibility gate. JS only records
  // which form the user intended to reach (FUN-04).
  safeFeature('application cards', function () {
    var applicationLinks = document.querySelectorAll('[data-application-form]');

    if (!applicationLinks.length) return;

    // A fresh visit to the application hub always starts from a clean slate (FUN-02).
    safeStorageRemove(TARGET_URL_KEY);

    applicationLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        // Deliberately no preventDefault(): the anchor's own href routes the user
        // through the gate even if this handler or storage fails (FUN-03).
        safeStorageSet(TARGET_URL_KEY, link.dataset.applicationForm);
      });
    });
  });

  // ===== Footer email de-obfuscation (CHROME-03) =====
  // The address is absent from the served HTML; it is assembled at runtime from
  // reversed parts so simple harvesting bots don't see a plain mailbox. Visitors
  // without JavaScript see the envelope icon but no address.
  safeFeature('footer email', function () {
    document.querySelectorAll('.js-email').forEach(function (el) {
      var user = el.getAttribute('data-u');
      var domain = el.getAttribute('data-d');
      if (!user || !domain) return;
      el.textContent = user + '@' + domain.split('').reverse().join('');
    });
  });

  // ===== Eligibility gate (country-check.html) =====
  safeFeature('eligibility gate', function () {
    var countryGateForm = document.getElementById('country-gate-form');
    if (!countryGateForm) return;

    var residenceSelect = document.getElementById('residence-select');
    var passportSelect = document.getElementById('passport-country');
    var destinationSelect = document.getElementById('destination-select');

    // The <option> lists in country-check.html are the single source of truth for
    // eligible countries. Validation is derived from them, so the form UI and the
    // eligibility logic can never drift apart (FUN-05).
    function allowedValues(select) {
      return Array.prototype.map
        .call(select.options, function (option) { return option.value; })
        .filter(function (value) { return value && value !== 'Other'; });
    }

    // One code path decides eligibility (FUN-06): the "Other" change listeners
    // were removed and everything is resolved here on submit.
    countryGateForm.addEventListener('submit', function (event) {
      event.preventDefault();

      var residence = residenceSelect.value;
      var passportCountry = passportSelect.value;
      var selectedDestination = destinationSelect.value;
      var visaEligible = countryGateForm.elements.visaEligible.value;
      var targetUrl = safeStorageGet(TARGET_URL_KEY);

      if (residence === 'Other' || allowedValues(residenceSelect).indexOf(residence) === -1) {
        window.location.href = 'application-closed.html?reason=location';
        return;
      }

      if (allowedValues(passportSelect).indexOf(passportCountry) === -1) {
        window.location.href = 'application-closed.html?reason=passport';
        return;
      }

      if (!targetUrl) {
        window.location.href = 'contact.html';
        return;
      }

      if (visaEligible === 'yes') {
        // The gate is complete; clear the stored target so it can't leak into a
        // later, unrelated visit to the gate (FUN-02).
        safeStorageRemove(TARGET_URL_KEY);
        window.location.href = appendDestination(targetUrl, selectedDestination);
      } else {
        var outcome = visaEligible === 'no' ? 'ineligible' : 'unsure';
        window.location.href =
          'application-closed.html?reason=' + outcome +
          '&destination=' + encodeURIComponent(selectedDestination);
      }
    });
  });

  // ===== Gate outcome messaging (application-closed.html) =====
  safeFeature('gate outcome messaging', function () {
    var closedPage = document.querySelector('.country-closed-card');
    if (!closedPage) return;

    var params = new URLSearchParams(window.location.search);
    var reason = params.get('reason');
    var destination = params.get('destination');
    var heading = document.getElementById('eligibility-heading');
    var message = document.getElementById('eligibility-message');
    var visaInformation = document.getElementById('visa-information');
    var recheckLink = document.getElementById('eligibility-recheck');
    var nzVisaLink = document.getElementById('nz-visa-link');
    var au417VisaLink = document.getElementById('au-417-visa-link');
    var au462VisaLink = document.getElementById('au-462-visa-link');

    function toggleVisaLink(link, visible) {
      if (link) link.classList.toggle('d-none', !visible);
    }

    // Only show the visa route(s) relevant to the chosen destination (FUN-01).
    function applyDestinationLinks() {
      var isNewZealand = destination === 'New Zealand';
      var isAustralia = destination === 'Australia';
      toggleVisaLink(nzVisaLink, !isAustralia);
      toggleVisaLink(au417VisaLink, !isNewZealand);
      toggleVisaLink(au462VisaLink, !isNewZealand);
    }

    if (reason === 'location') {
      heading.textContent = 'Thank you for your interest in Agribridge';
      message.textContent = "AgriBridge currently considers candidates based in Ireland, the UK (including Scotland), Germany, Norway, the Netherlands, or Finland. We can't progress applications from other locations at this time.";
      visaInformation.classList.add('d-none');
      recheckLink.hidden = true;
    } else if (reason === 'unsure') {
      heading.textContent = 'Not sure about your visa eligibility?';
      if (destination === 'Australia') {
        message.textContent = "That doesn't mean you're ineligible. Australia has two Working Holiday visas — subclass 417 and subclass 462 — and which one applies depends on your nationality. Check the official requirements for the one that matches you. If you meet them, return to the application check and select Yes.";
      } else if (destination === 'New Zealand') {
        message.textContent = "That doesn't mean you're ineligible. Check the official New Zealand working holiday visa requirements. If you meet them, return to the application check and select Yes.";
      } else {
        message.textContent = "That doesn't mean you're ineligible. Check the official visa requirements for your chosen destination. If you meet them, return to the application check and select Yes.";
      }
      applyDestinationLinks();
      recheckLink.hidden = false;
    } else if (reason === 'passport') {
      heading.textContent = 'We can’t progress this application';
      message.textContent = 'AgriBridge currently considers candidates based in Ireland, the UK (including Scotland), Germany, Norway, the Netherlands, or Finland. Applicants must hold a passport issued by one of those countries; we’re unable to progress applications with other passports at this time.';
      visaInformation.classList.add('d-none');
      recheckLink.hidden = true;
    } else {
      heading.textContent = 'You may not meet the visa requirements';
      if (destination === 'Australia') {
        message.textContent = "Based on your answer, you may not be eligible for an Australian Working Holiday visa (subclass 417 or 462), so we cannot progress this application. Check the official requirements in case your circumstances change.";
      } else if (destination === 'New Zealand') {
        message.textContent = "Based on your answer, you may not be eligible for the New Zealand working holiday visa, so we cannot progress this application. Check the official requirements in case your circumstances change.";
      } else {
        message.textContent = 'Based on your answer, you may not be eligible for a Working Holiday visa for your chosen destination, so we cannot progress this application. Check the official requirements in case your circumstances change.';
      }
      applyDestinationLinks();
      visaInformation.classList.remove('d-none');
      recheckLink.hidden = true;
    }
  });

  // ===== Gallery thumbnail reveal =====
  // Grid thumbnails are real <img src> elements using native loading="lazy",
  // so they render with or without JavaScript (GAL-01). This only marks an
  // image once it has decoded so the CSS shimmer placeholder can stop.
  safeFeature('gallery thumbnails', function () {
    document.querySelectorAll('.gallery-thumb img').forEach(function (img) {
      function markLoaded() { img.classList.add('loaded'); }
      if (img.complete) {
        markLoaded();
      } else {
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', markLoaded, { once: true });
      }
    });
  });

  // ===== Gallery Filter =====
  safeFeature('gallery filter', function () {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const allCards = Array.from(document.querySelectorAll('.gallery-card'));

    if (!filterBtns.length) return;

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var filter = btn.dataset.filter;

        allCards.forEach(function (card) {
          if (filter === 'all' || card.dataset.type === filter) {
            card.classList.remove('hidden-card');
          } else {
            card.classList.add('hidden-card');
          }
        });

        // Re-run pagination after filter
        if (typeof window.initPagination === 'function') {
          window.initPagination();
        }
      });
    });
  });

  // ===== Lightbox =====
  safeFeature('lightbox', function () {
    const galleryItems = document.querySelectorAll(".gallery-item");
    const lightbox = document.getElementById("lightbox");
    const lightboxContent = document.getElementById("lightbox-content");
    const closeBtn = document.querySelector(".lightbox-close");
    const prevBtn = document.querySelector(".lightbox-prev");
    const nextBtn = document.querySelector(".lightbox-next");
    const counterCurrent = document.getElementById("lightbox-current");
    const counterTotal = document.getElementById("lightbox-total");

    if (!lightbox || !galleryItems.length) return;

    var currentIndex = 0;
    // Snapshot of the visible media, rebuilt when the lightbox opens. Navigation
    // then works off this list instead of re-querying live filter/pagination
    // classes on every keypress (GAL-04).
    var lightboxItems = [];
    var lastFocusedElement = null;

    function getVisibleItems() {
      return Array.from(document.querySelectorAll('.gallery-card:not(.hidden-card):not(.d-none) .gallery-item'));
    }

    function refreshLightboxItems() {
      lightboxItems = getVisibleItems();
      return lightboxItems;
    }

    function mediaSource(item) {
      return item ? item.getAttribute("data-target") : null;
    }

    function showMedia(index) {
      if (!lightboxItems.length) return;
      if (index < 0) index = 0;
      if (index >= lightboxItems.length) index = lightboxItems.length - 1;
      currentIndex = index;

      var mediaSrc = mediaSource(lightboxItems[currentIndex]);
      if (!mediaSrc) return;
      var ext = mediaSrc.split('.').pop().toLowerCase();
      lightboxContent.innerHTML = '';

      if (ext === "mp4") {
        var reduceMotion = prefersReducedMotion();
        var video = document.createElement("video");
        video.controls = true;
        video.autoplay = !reduceMotion;
        // Autoplay is only dependable when muted; controls let users unmute.
        video.muted = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");
        var source = document.createElement("source");
        source.src = mediaSrc;
        source.type = "video/mp4";
        video.appendChild(source);
        lightboxContent.appendChild(video);
        // Reduced-motion visitors get a paused video they can start themselves.
        // Otherwise autoplay, ignoring browsers that still reject it.
        if (!reduceMotion) {
          var playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(function () {});
          }
        }
      } else {
        var img = document.createElement("img");
        img.src = mediaSrc;
        img.alt = "";
        lightboxContent.appendChild(img);
      }

      counterCurrent.textContent = currentIndex + 1;
      counterTotal.textContent = lightboxItems.length;
    }

    function getFocusableLightboxElements() {
      return Array.from(lightbox.querySelectorAll('button, [href], video[controls], [tabindex]:not([tabindex="-1"])'));
    }

    function openLightbox(index) {
      lastFocusedElement = document.activeElement;
      currentIndex = index;
      lightbox.classList.add("visible");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
      showMedia(currentIndex);
      // Move focus into the dialog (GAL-05).
      if (closeBtn) closeBtn.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove("visible");
      lightbox.setAttribute("aria-hidden", "true");
      lightboxContent.innerHTML = '';
      document.body.classList.remove("no-scroll");
      // Return focus to the thumbnail that opened the lightbox (GAL-05).
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
      lastFocusedElement = null;
    }

    function stepLightbox(delta) {
      if (!lightboxItems.length) return;
      currentIndex = (currentIndex + delta + lightboxItems.length) % lightboxItems.length;
      showMedia(currentIndex);
    }

    galleryItems.forEach(function (item) {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        refreshLightboxItems();
        var idx = lightboxItems.indexOf(item);
        if (idx === -1) idx = 0;
        openLightbox(idx);
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);

    // Click backdrop to close
    var backdrop = document.querySelector('.lightbox-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeLightbox);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(1);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stepLightbox(-1);
      });
    }

    // Keyboard navigation + focus trap (GAL-05)
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("visible")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") stepLightbox(1);
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "Tab") {
        var focusables = getFocusableLightboxElements();
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Touch swipe support
    var touchStartX = 0;
    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 50) {
        stepLightbox(diff < 0 ? 1 : -1);
      }
    }, { passive: true });
  });

  // ===== Pagination =====
  safeFeature('pagination', function () {
    var itemsPerPage = 12;
    var galleryContainer = document.getElementById("gallery-items");
    var paginationContainer = document.getElementById("pagination");

    if (!galleryContainer || !paginationContainer) return;

    function initPagination() {
      var visibleCards = Array.from(galleryContainer.querySelectorAll('.gallery-card:not(.hidden-card)'));
      var totalPages = Math.ceil(visibleCards.length / itemsPerPage);
      renderPage(1, visibleCards, totalPages);
    }
    // Expose globally so filters can call it
    window.initPagination = initPagination;

    function renderPage(page, visibleCards, totalPages) {
      visibleCards.forEach(function (item) { item.classList.add("d-none"); });
      var start = (page - 1) * itemsPerPage;
      var end = start + itemsPerPage;
      visibleCards.slice(start, end).forEach(function (item) { item.classList.remove("d-none"); });
      renderPagination(page, totalPages, visibleCards);
    }

    function renderPagination(currentPage, totalPages, visibleCards) {
      paginationContainer.innerHTML = "";
      if (totalPages <= 1) return;
      for (var i = 1; i <= totalPages; i++) {
        (function (pageNum) {
          var li = document.createElement("li");
          li.className = "page-item" + (pageNum === currentPage ? " active" : "");
          li.innerHTML = '<a class="page-link" href="#">' + pageNum + '</a>';
          li.addEventListener("click", function (e) {
            e.preventDefault();
            renderPage(pageNum, visibleCards, totalPages);
            window.scrollTo({
              top: galleryContainer.offsetTop - 100,
              behavior: prefersReducedMotion() ? 'auto' : 'smooth'
            });
          });
          paginationContainer.appendChild(li);
        })(i);
      }
    }

    initPagination();
  });
});
