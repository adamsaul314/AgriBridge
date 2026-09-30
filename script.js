document.addEventListener("DOMContentLoaded", function () {

  const countryGateForm = document.getElementById('country-gate-form');
  if (countryGateForm) {
    const residenceSelect = document.getElementById('residence-select');
    const passportSelect = document.getElementById('passport-country');

    residenceSelect.addEventListener('change', function () {
      if (residenceSelect.value === 'Other') {
        window.location.href = 'application-closed.html?reason=location';
      }
    });

    passportSelect.addEventListener('change', function () {
      if (passportSelect.value === 'Other') {
        window.location.href = 'application-closed.html?reason=passport';
      }
    });

    countryGateForm.addEventListener('submit', function (event) {
      event.preventDefault();

      const residence = residenceSelect.value;
      const passportCountry = passportSelect.value;
      const visaEligible = countryGateForm.elements.visaEligible.value;
      const targetUrl = sessionStorage.getItem('agribridgeTargetUrl');

      if (residence === 'Other') {
        window.location.href = 'application-closed.html?reason=location';
        return;
      }

      if (!['Ireland', 'United Kingdom', 'Germany', 'Norway', 'Netherlands', 'Finland'].includes(passportCountry)) {
        window.location.href = 'application-closed.html?reason=passport';
        return;
      }

      if (!targetUrl) {
        window.location.href = 'contact.html';
        return;
      }

      if (visaEligible === 'yes') {
        window.location.href = targetUrl;
      } else {
        const reason = visaEligible === 'no' ? 'ineligible' : 'unsure';
        window.location.href = 'application-closed.html?reason=' + reason;
      }
    });
  }

  const closedPage = document.querySelector('.country-closed-card');
  if (closedPage) {
    const reason = new URLSearchParams(window.location.search).get('reason');
    const heading = document.getElementById('eligibility-heading');
    const message = document.getElementById('eligibility-message');
    const visaInformation = document.getElementById('visa-information');
    const recheckLink = document.getElementById('eligibility-recheck');

    if (reason === 'location') {
      heading.textContent = 'Thank you for your interest in Agribridge';
      message.textContent = "We currently consider candidates based in Ireland, Scotland, elsewhere in the UK, Germany, Norway, the Netherlands, and Finland. We can't progress applications from other locations at this time.";
      visaInformation.classList.add('d-none');
      recheckLink.hidden = true;
    } else if (reason === 'unsure') {
      heading.textContent = 'Not sure about your visa eligibility?';
      message.textContent = "That doesn't mean you're ineligible. Check the official visa requirements for your chosen destination. If you meet them, return to the application check and select Yes.";
      recheckLink.hidden = false;
    } else if (reason === 'passport') {
      heading.textContent = 'We can’t progress this application';
      message.textContent = 'At present, we can only consider applicants holding passports issued by Ireland, the United Kingdom, Germany, Norway, the Netherlands, or Finland. We’re unable to progress applications with other passports at this time.';
      visaInformation.classList.add('d-none');
      recheckLink.hidden = true;
    } else {
      heading.textContent = 'You may not meet the visa requirements';
      message.textContent = 'Based on your answer, you may not be eligible for a Working Holiday visa for your chosen destination, so we cannot progress this application. Check the official visa requirements in case your circumstances change.';
      visaInformation.classList.remove('d-none');
      recheckLink.hidden = true;
    }
  }

  const applicationLinks = document.querySelectorAll('[data-application-form]');
  applicationLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      const targetUrl = link.dataset.applicationForm;
      sessionStorage.setItem('agribridgeTargetUrl', targetUrl);
      window.location.href = 'country-check.html';
    });
  });

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
