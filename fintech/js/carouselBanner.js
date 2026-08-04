
function carouselBanner() {

  var CONTAINER_ID = "novapay-carousel-inapp-container";
  var STYLE_ID = "novapay-carousel-inapp-styles";

  var defaultSlides = [
    {
      image: "images/scenes/hero-cards.svg",
      title: "Cards",
      description: "Four card tiers, from a free-to-hold everyday card to metal with 2% back.",
      alt: "The NovaPay card range"
    },
    {
      image: "images/scenes/scene-team.svg",
      title: "NovaPay Metal Card",
      description: "NovaPay Metal: 2% back on everything, no exchange markup, lounge access for two.",
      alt: "NovaPay Metal Card"
    },
    {
      image: "images/scenes/hero-invest.svg",
      title: "Protection",
      description: "Cover for your trips, your devices and everything you buy on the card.",
      alt: "NovaPay protection products"
    },
    {
      image: "images/scenes/hero-cards.svg",
      title: "Cards",
      description: "A specialist can compare the tiers with you and open the account on the call.",
      alt: "A NovaPay specialist call"
    },
    {
      image: "images/scenes/scene-vault.svg",
      title: "Statement Pieces",
      description: "Savings Boost pays 4.85% daily, and Managed Portfolios rebalance themselves.",
      alt: "NovaPay savings"
    },
    {
      image: "images/scenes/hero-invest.svg",
      title: "Savings and investing",
      description: "Model the fees against your own spending before you commit to a tier.",
      alt: "NovaPay savings and investing"
    }
  ];

  var config = {
    headerTitle: "This month at NovaPay",
    slides: defaultSlides
  };

  var currentSlide = 0;
  var slidesEl = null;
  var indicatorsEl = null;
  var totalSlides = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".novapay-carousel-overlay { position: fixed; inset: 0; min-height: 100svh; padding: 16px; display: grid; place-items: center; background: radial-gradient(circle at center, rgba(212, 168, 83, 0.18), rgba(28, 28, 28, 0.55)); z-index: 100020; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }",
      ".novapay-carousel-overlay.hidden { display: none !important; }",
      ".novapay-carousel-popup { position: relative; width: min(100%, 760px); border-radius: 18px; overflow: hidden; background: #f6f4fa; box-shadow: 0 20px 60px rgba(28, 28, 28, 0.32); border: 1px solid rgba(184, 134, 11, 0.22); }",
      ".novapay-carousel-header { background: linear-gradient(135deg, #1A1030 0%, #35015F 58%, #4E018F 100%); border-bottom: 3px solid #4E018F; color: #F6F4FA; text-align: center; padding: 16px 56px 16px 16px; font-family: 'Barlow Condensed', Georgia, serif; font-size: 22px; font-weight: 500; letter-spacing: 0.04em; }",
      ".novapay-carousel-close { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,0.35); border-radius: 50%; background: rgba(28,28,28,0.5); color: #fff; font-size: 16px; cursor: pointer; z-index: 20; line-height: 1; display: flex; align-items: center; justify-content: center; transition: background 0.2s ease; }",
      ".novapay-carousel-close:hover { background: rgba(28,28,28,0.75); }",
      ".novapay-carousel-container { position: relative; overflow: hidden; background: #f6f4fa; }",
      ".novapay-carousel-slides { display: flex; transition: transform 0.35s ease; will-change: transform; touch-action: pan-y; }",
      ".novapay-carousel-slide { min-width: 100%; padding: 18px; text-align: center; box-sizing: border-box; }",
      ".novapay-carousel-slide img { width: 100%; aspect-ratio: 1024/768; object-fit: cover; border-radius: 12px; display: block; background: #ede9f5; box-shadow: 0 8px 22px rgba(28,28,28,0.15); }",
      ".novapay-carousel-slide h3 { margin: 16px 0 8px; color: #1A1030; font-family: 'Barlow Condensed', Georgia, serif; font-size: 26px; font-weight: 500; line-height: 1.2; letter-spacing: 0.01em; }",
      ".novapay-carousel-slide p { margin: 0 auto; max-width: 540px; color: #3A3A3A; font-size: 15px; line-height: 1.55; min-height: 44px; }",
      ".novapay-carousel-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 42px; height: 42px; border: 1px solid rgba(184,134,11,0.45); border-radius: 50%; background: rgba(255,251,245,0.92); color: #35015F; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; transition: background 0.2s ease, color 0.2s ease; }",
      ".novapay-carousel-nav:hover { background: #1A1030; color: #4E018F; border-color: #1A1030; }",
      ".novapay-carousel-nav.prev { left: 12px; } .novapay-carousel-nav.next { right: 12px; }",
      ".novapay-carousel-indicators { display: flex; justify-content: center; gap: 8px; padding: 4px 0 20px; background: #f6f4fa; }",
      ".novapay-carousel-dot { width: 10px; height: 10px; border-radius: 50%; background: #d9cdb8; cursor: pointer; transition: background-color 0.25s ease, transform 0.25s ease; }",
      ".novapay-carousel-dot.active { background: #4E018F; transform: scale(1.15); }",
      "@media (max-width: 768px) { .novapay-carousel-overlay { padding: 10px; } .novapay-carousel-popup { border-radius: 14px; } .novapay-carousel-header { font-size: 18px; padding: 14px 50px 14px 14px; } .novapay-carousel-slide { padding: 12px; } .novapay-carousel-slide h3 { font-size: 21px; } .novapay-carousel-slide p { font-size: 13px; min-height: 38px; } .novapay-carousel-nav { width: 36px; height: 36px; font-size: 19px; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildSlidesHTML(slides) {
    if (!slides || !slides.length) return "";
    return slides
      .map(function (s) {
        var img = s.image || "";
        var alt = s.alt != null ? s.alt : "NovaPay";
        var title = s.title != null ? s.title : "";
        var desc = s.description != null ? s.description : "";
        return (
          '<div class="novapay-carousel-slide">' +
          '<img src="' + img + '" alt="' + alt + '">' +
          "<h3>" + title + "</h3>" +
          "<p>" + desc + "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function ensureDOM() {
    if (document.getElementById(CONTAINER_ID)) return;
    injectStyles();
    var overlay = document.createElement("div");
    overlay.id = CONTAINER_ID;
    overlay.className = "novapay-carousel-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    var slides = config.slides || defaultSlides;
    var slidesHTML = buildSlidesHTML(slides);
    overlay.innerHTML =
      '<div class="novapay-carousel-popup">' +
      '<button class="novapay-carousel-close" aria-label="Close" type="button">&#10005;</button>' +
      '<div class="novapay-carousel-header">' + (config.headerTitle || "This month at NovaPay") + "</div>" +
      '<div class="novapay-carousel-container">' +
      '<button class="novapay-carousel-nav prev" aria-label="Previous" type="button">&#8249;</button>' +
      '<div class="novapay-carousel-slides">' + slidesHTML + "</div>" +
      '<button class="novapay-carousel-nav next" aria-label="Next" type="button">&#8250;</button>' +
      "</div>" +
      '<div class="novapay-carousel-indicators"></div>' +
      "</div>";
    document.body.appendChild(overlay);

    slidesEl = overlay.querySelector(".novapay-carousel-slides");
    indicatorsEl = overlay.querySelector(".novapay-carousel-indicators");
    totalSlides = slidesEl ? slidesEl.children.length : 0;

    overlay.querySelector(".novapay-carousel-close").addEventListener("click", hide);
    overlay.querySelector(".novapay-carousel-nav.prev").addEventListener("click", function () { changeSlide(-1); });
    overlay.querySelector(".novapay-carousel-nav.next").addEventListener("click", function () { changeSlide(1); });

    var startX = 0,
      endX = 0;
    if (slidesEl) {
      slidesEl.addEventListener("touchstart", function (e) {
        startX = e.changedTouches[0].screenX;
      }, { passive: true });
      slidesEl.addEventListener("touchend", function (e) {
        endX = e.changedTouches[0].screenX;
        var diff = endX - startX;
        if (Math.abs(diff) > 40) changeSlide(diff > 0 ? -1 : 1);
      }, { passive: true });
    }

    createIndicators();
  }

  function createIndicators() {
    if (!indicatorsEl || totalSlides === 0) return;
    var html = "";
    for (var i = 0; i < totalSlides; i++) {
      html += '<span class="novapay-carousel-dot' + (i === 0 ? " active" : "") + '" data-index="' + i + '"></span>';
    }
    indicatorsEl.innerHTML = html;
    var dots = indicatorsEl.querySelectorAll(".novapay-carousel-dot");
    for (var j = 0; j < dots.length; j++) {
      (function (idx) {
        dots[idx].addEventListener("click", function () {
          goToSlide(idx);
        });
      })(j);
    }
  }

  function updateCarousel() {
    if (!slidesEl) return;
    slidesEl.style.transform = "translateX(-" + currentSlide * 100 + "%)";
    var dots = document.querySelectorAll(".novapay-carousel-dot");
    for (var i = 0; i < dots.length; i++) dots[i].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
  }

  function changeSlide(step) {
    currentSlide = (currentSlide + step + totalSlides) % totalSlides;
    updateCarousel();
  }

  function goToSlide(index) {
    if (index >= 0 && index < totalSlides) {
      currentSlide = index;
      updateCarousel();
    }
  }

  function show() {
    ensureDOM();
    var overlay = document.getElementById(CONTAINER_ID);
    if (overlay) {
      currentSlide = 0;
      updateCarousel();
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function hide() {
    var overlay = document.getElementById(CONTAINER_ID);
    if (overlay) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  function init(options) {
    if (options && options.headerTitle != null) config.headerTitle = options.headerTitle;
    if (options && options.slides && options.slides.length) config.slides = options.slides;
    var existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
    slidesEl = null;
    indicatorsEl = null;
    totalSlides = 0;
  }

  window.CarouselInappPopup = {
    show: show,
    hide: hide,
    init: init
  };

  show();
}
