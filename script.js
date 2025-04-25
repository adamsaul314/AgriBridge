document.addEventListener("DOMContentLoaded", function () {
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.querySelector(".close");
  const prevBtn = document.querySelector(".prev");
  const nextBtn = document.querySelector(".next");

  // Open lightbox when clicking on an image
  galleryItems.forEach(item => {
    item.addEventListener("click", function (e) {
      const imgSrc = e.currentTarget.getAttribute("data-target"); 
      lightbox.classList.add("visible");
      lightboxImg.src = imgSrc; 
    });
  });

  closeBtn.addEventListener("click", function () {
    lightbox.classList.remove("visible");
  });

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) {
      lightbox.classList.remove("visible");
    }
  });

  let currentIndex = 0;
  const images = Array.from(galleryItems).map(item => item.getAttribute("data-target"));

  function showImage(index) {
    lightboxImg.src = images[index];
  }

  nextBtn.addEventListener("click", function (e) {
    currentIndex = (currentIndex + 1) % images.length;
    showImage(currentIndex);
    e.stopPropagation(); 
  });

  prevBtn.addEventListener("click", function (e) {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    showImage(currentIndex);
    e.stopPropagation(); 
  });
});


const workerTab = document.getElementById('worker-tab');
    const employerTab = document.getElementById('employer-tab');
    const workerForm = document.getElementById('worker-form');
    const employerForm = document.getElementById('employer-form');

    workerTab.addEventListener('click', () => {
      workerTab.classList.add('active');
      employerTab.classList.remove('active');
      workerForm.style.display = 'block';
      employerForm.style.display = 'none';
    });

    employerTab.addEventListener('click', () => {
      employerTab.classList.add('active');
      workerTab.classList.remove('active');
      employerForm.style.display = 'block';
      workerForm.style.display = 'none';
    });
