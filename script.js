document.addEventListener("DOMContentLoaded", function () {
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxContent = document.getElementById("lightbox-content");
  const closeBtn = document.querySelector(".close");
  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");

  galleryItems.forEach(item => {
    item.addEventListener("click", function (e) {
      const mediaSrc = e.currentTarget.getAttribute("data-target"); 
      const fileExtension = mediaSrc.split('.').pop().toLowerCase();

      lightboxContent.innerHTML = '';

      if (fileExtension === "mp4") {
        const videoElement = document.createElement("video");
        videoElement.controls = true;
        const source = document.createElement("source");
        source.src = mediaSrc;
        source.type = "video/mp4";
        videoElement.appendChild(source);
        lightboxContent.appendChild(videoElement);
      } else if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
        const imageElement = document.createElement("img");
        imageElement.src = mediaSrc;
        lightboxContent.appendChild(imageElement);
      }

      lightbox.classList.add("visible");
      document.body.classList.add("no-scroll"); // 🔒 Disable scroll
    });
  });

  function closeLightbox() {
    lightbox.classList.remove("visible");
    lightboxContent.innerHTML = '';
    document.body.classList.remove("no-scroll"); // ✅ Enable scroll
  }

  closeBtn.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  let currentIndex = 0;
  const mediaFiles = Array.from(galleryItems).map(item => item.getAttribute("data-target"));

  function showMedia(index) {
    const mediaSrc = mediaFiles[index];
    const fileExtension = mediaSrc.split('.').pop().toLowerCase();
    lightboxContent.innerHTML = '';

    if (fileExtension === "mp4") {
      const videoElement = document.createElement("video");
      videoElement.controls = true;
      const source = document.createElement("source");
      source.src = mediaSrc;
      source.type = "video/mp4";
      videoElement.appendChild(source);
      lightboxContent.appendChild(videoElement);
    } else if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
      const imageElement = document.createElement("img");
      imageElement.src = mediaSrc;
      lightboxContent.appendChild(imageElement);
    }
  }

  nextBtn.addEventListener("click", function (e) {
    currentIndex = (currentIndex + 1) % mediaFiles.length;
    showMedia(currentIndex);
    e.stopPropagation(); 
  });

  prevBtn.addEventListener("click", function (e) {
    currentIndex = (currentIndex - 1 + mediaFiles.length) % mediaFiles.length;
    showMedia(currentIndex);
    e.stopPropagation(); 
  });
});

document.addEventListener("DOMContentLoaded", function () {
  // Tab functionality for Contact Page
  const workerTab = document.getElementById("worker-tab");
  const employerTab = document.getElementById("employer-tab");

  const workerForm = document.getElementById("worker-form");
  const employerForm = document.getElementById("employer-form");

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
});
