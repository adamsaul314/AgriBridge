document.addEventListener("DOMContentLoaded", function () {
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxContent = document.getElementById("lightbox-content"); // new div to handle both image and video
  const closeBtn = document.querySelector(".close");
  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");

  // Open lightbox when clicking on an image or video
  galleryItems.forEach(item => {
    item.addEventListener("click", function (e) {
      const mediaSrc = e.currentTarget.getAttribute("data-target"); 
      const fileExtension = mediaSrc.split('.').pop().toLowerCase();

      // Reset the lightbox content before changing
      lightboxContent.innerHTML = '';

      // Check if it's an image or a video
      if (fileExtension === "mp4") {
        const videoElement = document.createElement("video");
        videoElement.controls = true;
        const source = document.createElement("source");
        source.src = mediaSrc;
        source.type = "video/mp4";
        videoElement.appendChild(source);
        lightboxContent.appendChild(videoElement);
      } else if (fileExtension === "jpg" || fileExtension === "jpeg" || fileExtension === "png" || fileExtension === "gif") {
        const imageElement = document.createElement("img");
        imageElement.src = mediaSrc;
        lightboxContent.appendChild(imageElement);
      }

      lightbox.classList.add("visible");
    });
  });

  closeBtn.addEventListener("click", function () {
    lightbox.classList.remove("visible");
    lightboxContent.innerHTML = ''; // Remove media when closing
  });

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) {
      lightbox.classList.remove("visible");
      lightboxContent.innerHTML = ''; // Remove media when closing
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
    } else if (fileExtension === "jpg" || fileExtension === "jpeg" || fileExtension === "png" || fileExtension === "gif") {
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
