// AgriBridge — shared feature module (loaded by every page via main.js).
//
// This module exports small, named pieces so they can be unit-tested without a
// browser. Pure helpers (country lists, URL building, message selection, page
// maths) have no DOM dependency; the `init*` functions wire features to the DOM
// and each returns early when its markup is absent, so loading the bundle on an
// unrelated page is harmless (JS-02).
//
// Convention for new work: add a pure helper with an export, add one init
// function, and register it in bootstrap(). Failures stay contained via
// runFeature(); share state inside a feature, not across features.

// ===== Error isolation (JS-03) =====
// Each feature initialises inside its own guard. If one throws — unexpected
// markup, an unavailable browser API, storage being blocked — the error is
// logged and contained so the rest of the page's JavaScript still runs.
export function runFeature(name, init) {
  try {
    init();
  } catch (error) {
    if (window.console && typeof window.console.error === 'function') {
      window.console.error('AgriBridge: "' + name + '" failed to initialise.', error);
    }
  }
}

// A single honouring point for the user's motion preference. CSS handles
// styling; this covers behaviour CSS cannot control — smooth scrolling and
// video autoplay (SEO-03).
export function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function forEachNode(nodeList, callback) {
  Array.prototype.forEach.call(nodeList, callback);
}

// Small numeric helpers shared by the gallery.
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function pageCount(totalItems, itemsPerPage) {
  return Math.max(1, Math.ceil(totalItems / itemsPerPage));
}

export function pageSlice(items, page, itemsPerPage) {
  const totalPages = pageCount(items.length, itemsPerPage);
  const safePage = clamp(page, 1, totalPages);
  const start = (safePage - 1) * itemsPerPage;
  return { page: safePage, totalPages, items: items.slice(start, start + itemsPerPage) };
}

export function nextLightboxIndex(currentIndex, delta, length) {
  if (!length) return 0;
  return (currentIndex + delta + length) % length;
}

// ===== Funnel state =====
// The intended application form is kept in sessionStorage so it can be handed
// off after the eligibility gate. Storage can be unavailable (private mode,
// disabled storage, quota), so every access is guarded (FUN-03).
export const TARGET_FORM_KEY = 'agribridgeTargetUrl';

export const session = {
  get(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      // Storage unavailable: the gate still runs, the form is just not persisted.
    }
  },
  remove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      // Nothing to clear.
    }
  }
};

// Attach the chosen destination to the form hand-off so it is not lost (FUN-01).
export function withDestination(url, destination) {
  if (!destination) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('destination', destination);
    return parsed.toString();
  } catch (error) {
    const separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'destination=' + encodeURIComponent(destination);
  }
}

// ===== Application cards (contact.html) =====
// The anchors point at country-check.html so left-click, new-tab, modified-click
// and JS-disabled users all pass through the eligibility gate. JavaScript only
// records which form the user intended to reach (FUN-04).
export function initApplicationCards() {
  const applicationLinks = document.querySelectorAll('[data-application-form]');
  if (!applicationLinks.length) return;

  // A fresh visit to the application hub always starts from a clean slate (FUN-02).
  session.remove(TARGET_FORM_KEY);

  forEachNode(applicationLinks, function (link) {
    link.addEventListener('click', function () {
      // Deliberately no preventDefault(): the anchor's own href routes the user
      // through the gate even if this handler or storage fails (FUN-03).
      session.set(TARGET_FORM_KEY, link.dataset.applicationForm);
    });
  });
}

// ===== Footer email de-obfuscation (CHROME-03) =====
// The address is absent from the served HTML; it is assembled at runtime from
// reversed parts so simple harvesting bots don't see a plain mailbox. Visitors
// without JavaScript see the envelope icon but no address.
export function initFooterEmail() {
  forEachNode(document.querySelectorAll('.js-email'), function (element) {
    const user = element.getAttribute('data-u');
    const reversedDomain = element.getAttribute('data-d');
    if (!user || !reversedDomain) return;
    element.textContent = user + '@' + reversedDomain.split('').reverse().join('');
  });
}

// ===== Eligibility gate (country-check.html) =====
// The <option> lists in the HTML are the single source of truth for eligible
// countries. Validation is derived from them, so the form UI and the eligibility
// logic can never drift apart (FUN-05).
export function eligibleValues(select) {
  return Array.prototype.map
    .call(select.options, function (option) { return option.value; })
    .filter(function (value) { return value && value !== 'Other'; });
}

export function isEligible(select, value) {
  return eligibleValues(select).indexOf(value) !== -1;
}

// One code path decides eligibility (FUN-06). Pure so it can be tested directly;
// initEligibilityGate() reads the DOM and performs the resulting navigation.
export function gateDecision(input) {
  const {
    residence,
    passportCountry,
    destination,
    visaAnswer,
    targetFormUrl,
    residenceValues,
    passportValues
  } = input;

  if (residence === 'Other' || residenceValues.indexOf(residence) === -1) {
    return { type: 'redirect', url: 'application-closed.html?reason=location' };
  }

  if (passportValues.indexOf(passportCountry) === -1) {
    return { type: 'redirect', url: 'application-closed.html?reason=passport' };
  }

  if (!targetFormUrl) {
    return { type: 'redirect', url: 'contact.html' };
  }

  if (visaAnswer === 'yes') {
    return { type: 'apply', url: withDestination(targetFormUrl, destination) };
  }

  const reason = visaAnswer === 'no' ? 'ineligible' : 'unsure';
  return {
    type: 'redirect',
    url: 'application-closed.html?reason=' + reason +
      '&destination=' + encodeURIComponent(destination)
  };
}

export function initEligibilityGate() {
  const gateForm = document.getElementById('country-gate-form');
  if (!gateForm) return;

  const residenceSelect = document.getElementById('residence-select');
  const passportSelect = document.getElementById('passport-country');
  const destinationSelect = document.getElementById('destination-select');

  gateForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const decision = gateDecision({
      residence: residenceSelect.value,
      passportCountry: passportSelect.value,
      destination: destinationSelect.value,
      visaAnswer: gateForm.elements.visaEligible.value,
      targetFormUrl: session.get(TARGET_FORM_KEY),
      residenceValues: eligibleValues(residenceSelect),
      passportValues: eligibleValues(passportSelect)
    });

    // The gate is complete; clear the stored target so it can't leak into a
    // later, unrelated visit to the gate (FUN-02).
    if (decision.type === 'apply') session.remove(TARGET_FORM_KEY);
    window.location.href = decision.url;
  });
}

// ===== Gate outcome messaging (application-closed.html) =====
// Each reason maps to a heading, copy and which controls to show. Copy that
// varies by destination uses a lookup with a `default` fallback.
export const UNSURE_MESSAGES = {
  Australia: "That doesn't mean you're ineligible. Australia has two Working Holiday visas — subclass 417 and subclass 462 — and which one applies depends on your nationality. Check the official requirements for the one that matches you. If you meet them, return to the application check and select Yes.",
  'New Zealand': "That doesn't mean you're ineligible. Check the official New Zealand working holiday visa requirements. If you meet them, return to the application check and select Yes.",
  default: "That doesn't mean you're ineligible. Check the official visa requirements for your chosen destination. If you meet them, return to the application check and select Yes."
};

export const INELIGIBLE_MESSAGES = {
  Australia: "Based on your answer, you may not be eligible for an Australian Working Holiday visa (subclass 417 or 462), so we cannot progress this application. Check the official requirements in case your circumstances change.",
  'New Zealand': "Based on your answer, you may not be eligible for the New Zealand working holiday visa, so we cannot progress this application. Check the official requirements in case your circumstances change.",
  default: 'Based on your answer, you may not be eligible for a Working Holiday visa for your chosen destination, so we cannot progress this application. Check the official requirements in case your circumstances change.'
};

export function messageFor(messages, destination) {
  return messages[destination] || messages.default;
}

export const GATE_OUTCOMES = {
  location: {
    heading: 'Thank you for your interest in Agribridge',
    message: function () {
      return "AgriBridge currently considers candidates based in Ireland, the UK (including Scotland), Germany, Norway, the Netherlands, or Finland. We can't progress applications from other locations at this time.";
    },
    showVisaInformation: false,
    showRecheck: false
  },
  passport: {
    heading: 'We can’t progress this application',
    message: function () {
      return 'AgriBridge currently considers candidates based in Ireland, the UK (including Scotland), Germany, Norway, the Netherlands, or Finland. Applicants must hold a passport issued by one of those countries; we’re unable to progress applications with other passports at this time.';
    },
    showVisaInformation: false,
    showRecheck: false
  },
  unsure: {
    heading: 'Not sure about your visa eligibility?',
    message: function (destination) { return messageFor(UNSURE_MESSAGES, destination); },
    showVisaInformation: true,
    showRecheck: true
  }
};

export const INELIGIBLE_OUTCOME = {
  heading: 'You may not meet the visa requirements',
  message: function (destination) { return messageFor(INELIGIBLE_MESSAGES, destination); },
  showVisaInformation: true,
  showRecheck: false
};

export function resolveGateOutcome(reason) {
  return GATE_OUTCOMES[reason] || INELIGIBLE_OUTCOME;
}

// Writes one outcome into the page. Exported so it can be driven by a test
// fixture without touching window.location.
export function applyGateOutcome(reason, destination) {
  const outcome = resolveGateOutcome(reason);
  const heading = document.getElementById('eligibility-heading');
  const message = document.getElementById('eligibility-message');
  const visaInformation = document.getElementById('visa-information');
  const recheckLink = document.getElementById('eligibility-recheck');
  if (!heading || !message || !visaInformation || !recheckLink) return;

  heading.textContent = outcome.heading;
  message.textContent = outcome.message(destination);
  visaInformation.classList.toggle('d-none', !outcome.showVisaInformation);
  recheckLink.hidden = !outcome.showRecheck;

  if (!outcome.showVisaInformation) return;

  // Only show the visa route(s) relevant to the chosen destination (FUN-01).
  const isNewZealand = destination === 'New Zealand';
  const isAustralia = destination === 'Australia';

  const nzVisaLink = document.getElementById('nz-visa-link');
  const au417VisaLink = document.getElementById('au-417-visa-link');
  const au462VisaLink = document.getElementById('au-462-visa-link');
  if (nzVisaLink) nzVisaLink.classList.toggle('d-none', isAustralia);
  if (au417VisaLink) au417VisaLink.classList.toggle('d-none', isNewZealand);
  if (au462VisaLink) au462VisaLink.classList.toggle('d-none', isNewZealand);
}

export function initGateOutcome(search) {
  if (!document.querySelector('.country-closed-card')) return;
  const params = new URLSearchParams(search === undefined ? window.location.search : search);
  applyGateOutcome(params.get('reason'), params.get('destination'));
}

// ===== Gallery thumbnails =====
// Grid thumbnails are real <img> elements using native loading="lazy", so they
// render with or without JavaScript (GAL-01). This only marks an image once it
// has decoded so the CSS shimmer placeholder can stop.
export function initGalleryThumbnails() {
  forEachNode(document.querySelectorAll('.gallery-thumb img'), function (image) {
    function markLoaded() { image.classList.add('loaded'); }
    if (image.complete) {
      markLoaded();
      return;
    }
    image.addEventListener('load', markLoaded, { once: true });
    image.addEventListener('error', markLoaded, { once: true });
  });
}

export function isVideoSource(source) {
  return source.split('.').pop().toLowerCase() === 'mp4';
}

// ===== Gallery (filters + pagination + lightbox) =====
// These three features all operate on the same set of cards, so they live in one
// controller with shared state instead of reaching across features via a global.
// Filtering decides which cards are eligible; pagination decides which are on
// screen; the lightbox only ever navigates the on-screen cards.
export function initGallery() {
  const container = document.getElementById('gallery-items');
  const paginationList = document.getElementById('pagination');
  const lightbox = document.getElementById('lightbox');

  const filterButtons = document.querySelectorAll('.filter-btn');
  const allCards = Array.prototype.slice.call(document.querySelectorAll('.gallery-card'));
  const galleryItems = document.querySelectorAll('.gallery-item');

  if (!container && !lightbox && !filterButtons.length && !galleryItems.length) return;

  const ITEMS_PER_PAGE = 12;
  let currentPage = 1;

  function eligibleCards() {
    return allCards.filter(function (card) { return !card.classList.contains('hidden-card'); });
  }

  function scrollToGalleryTop() {
    if (!container) return;
    window.scrollTo({
      top: container.offsetTop - 100,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  // Built in its own scope so the click closes over the right page number.
  function createPageItem(pageNumber) {
    const item = document.createElement('li');
    item.className = 'page-item' + (pageNumber === currentPage ? ' active' : '');

    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = '#';
    link.textContent = String(pageNumber);
    link.addEventListener('click', function (event) {
      event.preventDefault();
      renderPage(pageNumber);
      scrollToGalleryTop();
    });

    item.appendChild(link);
    return item;
  }

  function renderPagination(totalPages) {
    if (!paginationList) return;
    paginationList.innerHTML = '';
    if (totalPages <= 1) return;

    for (let page = 1; page <= totalPages; page += 1) {
      paginationList.appendChild(createPageItem(page));
    }
  }

  function renderPage(page) {
    const cards = eligibleCards();
    const slice = pageSlice(cards, page, ITEMS_PER_PAGE);
    currentPage = slice.page;

    cards.forEach(function (card) { card.classList.add('d-none'); });
    slice.items.forEach(function (card) { card.classList.remove('d-none'); });

    renderPagination(slice.totalPages);
  }

  function applyFilter(filter) {
    allCards.forEach(function (card) {
      const matches = filter === 'all' || card.dataset.type === filter;
      card.classList.toggle('hidden-card', !matches);
    });
    renderPage(1);
  }

  forEachNode(filterButtons, function (button) {
    button.addEventListener('click', function () {
      forEachNode(filterButtons, function (other) { other.classList.remove('active'); });
      button.classList.add('active');
      applyFilter(button.dataset.filter);
    });
  });

  if (container && paginationList) {
    renderPage(1);
  }

  // ----- Lightbox -----
  if (!lightbox || !galleryItems.length) return;

  const lightboxContent = document.getElementById('lightbox-content');
  const closeButton = document.querySelector('.lightbox-close');
  const prevButton = document.querySelector('.lightbox-prev');
  const nextButton = document.querySelector('.lightbox-next');
  const counterCurrent = document.getElementById('lightbox-current');
  const counterTotal = document.getElementById('lightbox-total');

  // Snapshot of the visible media, rebuilt when the lightbox opens. Navigation
  // then works off this list instead of re-querying live filter/pagination
  // classes on every keypress (GAL-04).
  let lightboxItems = [];
  let currentIndex = 0;
  let lastFocusedElement = null;

  function mediaSource(item) {
    return item ? item.getAttribute('data-target') : null;
  }

  function buildVideo(source) {
    const reduceMotion = prefersReducedMotion();
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = !reduceMotion;
    // Autoplay is only dependable when muted; controls let users unmute.
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const sourceElement = document.createElement('source');
    sourceElement.src = source;
    sourceElement.type = 'video/mp4';
    video.appendChild(sourceElement);

    // Reduced-motion visitors get a paused video they can start themselves.
    // Otherwise autoplay, ignoring browsers that still reject it.
    if (!reduceMotion) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {});
      }
    }
    return video;
  }

  function buildImage(source) {
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    return image;
  }

  function showMedia(index) {
    if (!lightboxItems.length) return;
    currentIndex = clamp(index, 0, lightboxItems.length - 1);

    const source = mediaSource(lightboxItems[currentIndex]);
    if (!source) return;

    lightboxContent.innerHTML = '';
    lightboxContent.appendChild(isVideoSource(source) ? buildVideo(source) : buildImage(source));

    counterCurrent.textContent = String(currentIndex + 1);
    counterTotal.textContent = String(lightboxItems.length);
  }

  function focusableElements() {
    return Array.prototype.slice.call(
      lightbox.querySelectorAll('button, [href], video[controls], [tabindex]:not([tabindex="-1"])')
    );
  }

  function openLightbox(index) {
    lastFocusedElement = document.activeElement;
    lightbox.classList.add('visible');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    showMedia(index);
    // Move focus into the dialog (GAL-05).
    if (closeButton) closeButton.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('visible');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxContent.innerHTML = '';
    document.body.classList.remove('no-scroll');
    // Return focus to the thumbnail that opened the lightbox (GAL-05).
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function stepLightbox(delta) {
    if (!lightboxItems.length) return;
    currentIndex = nextLightboxIndex(currentIndex, delta, lightboxItems.length);
    showMedia(currentIndex);
  }

  function refreshLightboxItems(item) {
    lightboxItems = Array.prototype.slice.call(
      document.querySelectorAll('.gallery-card:not(.hidden-card):not(.d-none) .gallery-item')
    );
    const index = lightboxItems.indexOf(item);
    return index === -1 ? 0 : index;
  }

  forEachNode(galleryItems, function (item) {
    item.addEventListener('click', function (event) {
      event.preventDefault();
      openLightbox(refreshLightboxItems(item));
    });
  });

  if (closeButton) closeButton.addEventListener('click', closeLightbox);

  const backdrop = document.querySelector('.lightbox-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeLightbox);

  if (nextButton) {
    nextButton.addEventListener('click', function (event) {
      event.stopPropagation();
      stepLightbox(1);
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', function (event) {
      event.stopPropagation();
      stepLightbox(-1);
    });
  }

  // Keyboard navigation + focus trap (GAL-05)
  document.addEventListener('keydown', function (event) {
    if (!lightbox.classList.contains('visible')) return;

    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowRight') stepLightbox(1);
    if (event.key === 'ArrowLeft') stepLightbox(-1);
    if (event.key !== 'Tab') return;

    const focusables = focusableElements();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Touch swipe support
  let touchStartX = 0;
  lightbox.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', function (event) {
    const distance = event.changedTouches[0].screenX - touchStartX;
    if (Math.abs(distance) > 50) {
      stepLightbox(distance < 0 ? 1 : -1);
    }
  }, { passive: true });

  // Exposed for integration tests to drive the lightbox deterministically.
  return { openLightbox, closeLightbox, stepLightbox, refreshLightboxItems };
}

// ===== Bootstrap =====
export function bootstrap() {
  runFeature('application cards', initApplicationCards);
  runFeature('footer email', initFooterEmail);
  runFeature('eligibility gate', initEligibilityGate);
  runFeature('gate outcome messaging', initGateOutcome);
  runFeature('gallery thumbnails', initGalleryThumbnails);
  runFeature('gallery', initGallery);
}
