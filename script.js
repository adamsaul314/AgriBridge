document.addEventListener("DOMContentLoaded", function () {

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
  var applicationLinks = document.querySelectorAll('[data-application-form]');

  if (applicationLinks.length) {
    // A fresh visit to the application hub always starts from a clean slate (FUN-02).
    safeStorageRemove(TARGET_URL_KEY);
  }

  applicationLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      // Deliberately no preventDefault(): the anchor's own href routes the user
      // through the gate even if this handler or storage fails (FUN-03).
      safeStorageSet(TARGET_URL_KEY, link.dataset.applicationForm);
    });
  });

  // ===== Eligibility gate (country-check.html) =====
  var countryGateForm = document.getElementById('country-gate-form');
  if (countryGateForm) {
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
  }

  // ===== Gate outcome messaging (application-closed.html) =====
  var closedPage = document.querySelector('.country-closed-card');
  if (closedPage) {
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
      message.textContent = "We currently consider candidates based in Ireland, Scotland, elsewhere in the UK, Germany, Norway, the Netherlands, and Finland. We can't progress applications from other locations at this time.";
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
      message.textContent = 'At present, we can only consider applicants holding passports issued by Ireland, the United Kingdom, Germany, Norway, the Netherlands, or Finland. We’re unable to progress applications with other passports at this time.';
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
  }

  // ===== Lazy Loading with IntersectionObserver =====
  const lazyImages = document.querySelectorAll('.lazy-img');
  const lazyVideos = document.querySelectorAll('.lazy-video');

  const lazyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.tagName === 'IMG' && el.dataset.src) {
          el.src = el.dataset.src;
          el.onload = function () { el.classList.add('loaded'); };
          el.onerror = function () { el.classList.add('loaded'); };
        } else if (el.tagName === 'VIDEO' && el.dataset.src) {
          el.preload = 'metadata';
          el.src = el.dataset.src;
          el.onloadedmetadata = function () {
            el.currentTime = 1;
          };
          el.onseeked = function () {
            el.classList.add('loaded');
          };
          el.onerror = function () { el.classList.add('loaded'); };
        }
        lazyObserver.unobserve(el);
      }
    });
  }, { rootMargin: '200px' });

  lazyImages.forEach(function (img) { lazyObserver.observe(img); });
  lazyVideos.forEach(function (vid) { lazyObserver.observe(vid); });

  // ===== Gallery Filter =====
  const filterBtns = document.querySelectorAll('.filter-btn');
  const allCards = Array.from(document.querySelectorAll('.gallery-card'));

  if (filterBtns.length) {
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
        if (typeof initPagination === 'function') {
          initPagination();
        }
      });
    });
  }

  // ===== Lightbox =====
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxContent = document.getElementById("lightbox-content");
  const closeBtn = document.querySelector(".lightbox-close");
  const prevBtn = document.querySelector(".lightbox-prev");
  const nextBtn = document.querySelector(".lightbox-next");
  const counterCurrent = document.getElementById("lightbox-current");
  const counterTotal = document.getElementById("lightbox-total");

  var currentIndex = 0;

  function getVisibleItems() {
    return Array.from(document.querySelectorAll('.gallery-card:not(.hidden-card):not(.d-none) .gallery-item'));
  }

  function getMediaSources() {
    return getVisibleItems().map(function (item) { return item.getAttribute("data-target"); });
  }

  function showMedia(index) {
    var sources = getMediaSources();
    if (!sources.length) return;
    var mediaSrc = sources[index];
    var ext = mediaSrc.split('.').pop().toLowerCase();
    lightboxContent.innerHTML = '';

    if (ext === "mp4") {
      var video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      var source = document.createElement("source");
      source.src = mediaSrc;
      source.type = "video/mp4";
      video.appendChild(source);
      lightboxContent.appendChild(video);
    } else {
      var img = document.createElement("img");
      img.src = mediaSrc;
      lightboxContent.appendChild(img);
    }

    counterCurrent.textContent = index + 1;
    counterTotal.textContent = sources.length;
  }

  function openLightbox(index) {
    currentIndex = index;
    showMedia(currentIndex);
    lightbox.classList.add("visible");
    document.body.classList.add("no-scroll");
  }

  function closeLightbox() {
    lightbox.classList.remove("visible");
    lightboxContent.innerHTML = '';
    document.body.classList.remove("no-scroll");
  }

  galleryItems.forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      var visibleItems = getVisibleItems();
      var idx = visibleItems.indexOf(item);
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
      var total = getMediaSources().length;
      currentIndex = (currentIndex + 1) % total;
      showMedia(currentIndex);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var total = getMediaSources().length;
      currentIndex = (currentIndex - 1 + total) % total;
      showMedia(currentIndex);
    });
  }

  // Keyboard navigation
  document.addEventListener("keydown", function (e) {
    if (!lightbox || !lightbox.classList.contains("visible")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") {
      var total = getMediaSources().length;
      currentIndex = (currentIndex + 1) % total;
      showMedia(currentIndex);
    }
    if (e.key === "ArrowLeft") {
      var total = getMediaSources().length;
      currentIndex = (currentIndex - 1 + total) % total;
      showMedia(currentIndex);
    }
  });

  // Touch swipe support
  var touchStartX = 0;
  if (lightbox) {
    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      var diff = e.changedTouches[0].screenX - touchStartX;
      var total = getMediaSources().length;
      if (Math.abs(diff) > 50) {
        if (diff < 0) {
          currentIndex = (currentIndex + 1) % total;
        } else {
          currentIndex = (currentIndex - 1 + total) % total;
        }
        showMedia(currentIndex);
      }
    }, { passive: true });
  }

  // ===== Pagination =====
  var itemsPerPage = 12;
  var galleryContainer = document.getElementById("gallery-items");
  var paginationContainer = document.getElementById("pagination");

  function initPagination() {
    if (!galleryContainer || !paginationContainer) return;
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
          window.scrollTo({ top: galleryContainer.offsetTop - 100, behavior: 'smooth' });
        });
        paginationContainer.appendChild(li);
      })(i);
    }
  }

  initPagination();
});

// ===== Contact Page Tab Functionality =====
document.addEventListener("DOMContentLoaded", function () {
  var workerTab = document.getElementById("worker-tab");
  var employerTab = document.getElementById("employer-tab");
  var workerForm = document.getElementById("worker-form");
  var employerForm = document.getElementById("employer-form");

  if (workerTab && employerTab) {
    workerTab.addEventListener("click", function () {
      workerForm.style.display = "block";
      employerForm.style.display = "none";
      workerTab.classList.add("active");
      employerTab.classList.remove("active");
    });

    employerTab.addEventListener("click", function () {
      workerForm.style.display = "none";
      employerForm.style.display = "block";
      employerTab.classList.add("active");
      workerTab.classList.remove("active");
    });
  }
});
