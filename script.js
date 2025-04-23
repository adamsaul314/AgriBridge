
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxVideo = document.getElementById("lightbox-video");
  const closeBtn = document.querySelector(".lightbox .close");
  const prevBtn = document.querySelector(".lightbox .prev");
  const nextBtn = document.querySelector(".lightbox .next");

  let mediaElements = [];
  let currentIndex = 0;

  galleryItems.forEach((item, index) => {
    const media = item.querySelector("img, video");
    mediaElements.push(media);

    item.addEventListener("click", () => {
      currentIndex = index;
      showMedia(currentIndex);
    });
  });

  function showMedia(index) {
    const media = mediaElements[index];
    lightbox.classList.remove("hidden");

    if (media.tagName === "IMG") {
      lightboxImg.src = media.src;
      lightboxImg.style.display = "block";
      lightboxVideo.style.display = "none";
    } else {
      lightboxVideo.src = media.querySelector("source").src;
      lightboxImg.style.display = "none";
      lightboxVideo.style.display = "block";
    }
  }

  function closeLightbox() {
    lightbox.classList.add("hidden");
    lightboxVideo.pause();
  }

  function changeMedia(step) {
    currentIndex = (currentIndex + step + mediaElements.length) % mediaElements.length;
    showMedia(currentIndex);
  }

  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", () => changeMedia(-1));
  nextBtn.addEventListener("click", () => changeMedia(1));

