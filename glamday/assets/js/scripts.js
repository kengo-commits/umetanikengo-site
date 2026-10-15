(() => {
  const tabletBreak = 1080;
  const mobileBreak = 768;
  const mobileXSBreak = 414;
  let pageOffsetX = window.scrollX;
  let pageOffsetY = window.scrollY;
  let frozeException = null;
  let isWindowFrozen = false;
  let isHeaderActive = false;

  // Base functions
  const detectBrowser = () => {
    const html = $('html');
    const init = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.indexOf('chrome') > -1 && userAgent.indexOf('edg/') <= -1) {
        html.addClass('is-chrome');
      } else {
        html.removeClass('is-chrome');
      }
      if (
        userAgent.indexOf('safari') > -1 &&
        userAgent.indexOf('chrome') <= -1
      ) {
        html.addClass('is-safari');
      } else {
        html.removeClass('is-safari');
      }
      if (userAgent.indexOf('firefox') > -1) {
        html.addClass('is-firefox');
      } else {
        html.removeClass('is-firefox');
      }
      if (
        userAgent.indexOf('msie ') > -1 ||
        userAgent.indexOf('trident/') > -1
      ) {
        html.addClass('is-ie');
      } else {
        html.removeClass('is-ie');
      }
      if (userAgent.indexOf('edg/') > -1) {
        html.addClass('is-edge');
      } else {
        html.removeClass('is-edge');
      }
    };
    $('html head meta[name="viewport"]').attr(
      'content',
      'width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=0'
    );
    $(window).on('load resize', () => {
      init();
    });
    init();
  };

  const detectDevice = () => {
    const html = $('html');
    const init = () => {
      const viewport = $('html head meta[name="viewport"]')[0];
      const userAgent = navigator.userAgent.toLowerCase();
      const orientation = window.matchMedia('(orientation: portrait)').matches;

      // System
      if (userAgent.indexOf('mac') > -1) {
        html.addClass('is-mac is-macos');
      } else {
        html.removeClass('is-mac is-macos');
      }
      if (userAgent.match(/(iphone|ipod|ipad)/)) {
        if (userAgent.match(/iphone/)) {
          if (window.screen.width < mobileBreak && window.screen.width >= 390) {
            html.addClass('is-iphone-12');
          } else {
            html.removeClass('is-iphone-12');
          }
          if (window.screen.width < mobileBreak && window.screen.width < 390) {
            html.addClass('is-iphone-10');
          } else {
            html.removeClass('is-iphone-10');
          }
          if (window.screen.width < mobileBreak && window.screen.width < 375) {
            html.addClass('is-iphone-5');
          } else {
            html.removeClass('is-iphone-5');
          }
          html.addClass('is-iphone');
        } else {
          html.removeClass('is-iphone-12 is-iphone-10 is-iphone-5 is-iphone');
        }
        if (userAgent.match(/ipod/)) {
          html.addClass('is-ipod');
        } else {
          html.removeClass('is-ipod');
        }
        if (userAgent.match(/ipad/)) {
          html.addClass('is-ipad');
        } else {
          html.removeClass('is-ipad');
        }
        html.addClass('is-ios');
      } else {
        html.removeClass('is-phone is-ipod is-ipad is-ios');
      }
      if (userAgent.indexOf('android') > -1) {
        html.addClass('is-android');
      } else {
        html.removeClass('is-android');
      }

      // Type
      if (
        navigator.maxTouchPoints === 1 &&
        userAgent.indexOf('Mobile') === -1
      ) {
        $('html').addClass('is-emulation');
      } else {
        $('html').removeClass('is-emulation');
      }
      if (
        (html.hasClass('is-mac') ||
          html.hasClass('is-ios') ||
          html.hasClass('is-android')) &&
        navigator.maxTouchPoints &&
        navigator.maxTouchPoints >= 1
      ) {
        $('html').addClass('is-touchable');
      } else {
        $('html').removeClass('is-touchable');
      }

      // Media
      if ($(window).width() < mobileBreak) {
        if (window.screen.width < mobileXSBreak) {
          viewport.setAttribute(
            'content',
            'width=' + mobileXSBreak + ', user-scalable=0'
          );
        } else {
          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1'
          );
        }
        $('html').removeClass('is-desktop is-tablet');
        $('html').addClass('is-mobile');
      } else {
        $('html').addClass('is-desktop');
        if (
          (window.screen.width >= mobileBreak &&
            window.screen.width <= tabletBreak) ||
          (window.screen.width < mobileBreak &&
            window.screen.height >= mobileBreak &&
            !orientation)
        ) {
          viewport.setAttribute(
            'content',
            'width=' + tabletBreak + ', user-scalable=0'
          );
          $('html').addClass('is-tablet');
        } else {
          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=0'
          );
          $('html').removeClass('is-tablet');
        }
        $('html').removeClass('is-mobile');
      }
    };
    $(window).on('load resize', () => {
      init();
    });
    init();
  };

  // Helper functions

  const isMobile = () => window.innerWidth <= mobileBreak - 0.02;

  const isTouchable = () => {
    return $('html').hasClass('is-touchable');
  };

  const isOutside = (event, container) => {
    if (
      !$(container).is(event.target) &&
      $(container).has(event.target).length === 0
    ) {
      return true;
    }
    return false;
  };

  const scrollFix = (target) => {
    const windowScrollLeft = $(window).scrollLeft();
    if (windowScrollLeft > 0 && $(target).css('position') === 'fixed') {
      $(target).css('left', -windowScrollLeft + 'px');
    } else {
      $(target).css('left', 0);
    }
  };

  const scrollLeft = () => {
    if (!$('.js-scroll-left').length) {
      return;
    }
    $(window).on('load scroll resize', () => {
      const winLeft = $(window).scrollLeft();
      $('.js-scroll-left').each((_index, target) => {
        const isReversed =
          $(target).attr('data-scroll-direction') === 'reversed' ? true : false;
        if (isReversed) {
          $('.js-scroll-left').css('left', winLeft + 'px');
        } else {
          $('.js-scroll-left').css('left', -winLeft + 'px');
        }
      });
    });
  };

  const frozeWindow = (isFrozen, exception) => {
    const classFrozenWindows = 'is-frozen-windows';
    const classFrozenOS = 'is-frozen-os';
    const freezeWindows = () => {
      if (isFrozen) {
        pageOffsetY = $(window).scrollTop();
        $('body').css({ top: -pageOffsetY + 'px', left: -pageOffsetX + 'px' });
        $('html').addClass(classFrozenWindows);
        isWindowFrozen = true;
      } else {
        isWindowFrozen = false;
        $('html').removeClass(classFrozenWindows);
        $('body').css({ top: 'auto', left: 'auto' });
        $(window).scrollLeft(pageOffsetX);
        $(window).scrollTop(pageOffsetY);
      }
    };
    const freezeOS = () => {
      if (isFrozen) {
        $('html').addClass(classFrozenOS);
        isWindowFrozen = true;
        if (exception.length) {
          frozeException = exception;
        } else {
          frozeException = null;
        }
        if (
          !$('html').attr('data-froze-state') ||
          $('html').attr('data-froze-state') !== 'ready'
        ) {
          document.body.addEventListener(
            'touchmove',
            (event) => {
              if (isWindowFrozen) {
                if (
                  frozeException !== null &&
                  frozeException.length &&
                  isOutside(event, frozeException)
                ) {
                  event.preventDefault();
                } else if (frozeException === null) {
                  event.preventDefault();
                }
              }
            },
            { passive: false }
          );
          $('html').attr('data-froze-state', 'ready');
        }
      } else {
        isWindowFrozen = false;
        $('html').removeClass(classFrozenOS);
      }
    };
    if (isFrozen) {
      if ($('html').hasClass('is-desktop') && !isTouchable()) {
        freezeWindows();
      } else {
        freezeOS();
      }
    } else if (!isFrozen && $('html').hasClass(classFrozenWindows)) {
      freezeWindows();
    } else if (!isFrozen && $('html').hasClass(classFrozenOS)) {
      freezeOS();
    }
    if (isFrozen) {
      $('.js-gallery .swiper').each((_index, target) => {
        const galleryViewport = $(target);
        if (galleryViewport.length && galleryViewport[0].swiper) {
          galleryViewport[0].swiper.autoplay.pause();
        }
      });
    } else {
      $('.js-gallery .swiper').each((_index, target) => {
        const galleryViewport = $(target);
        if (galleryViewport.length && galleryViewport[0].swiper) {
          galleryViewport[0].swiper.autoplay.resume();
        }
      });
    }
  };

  // Advance functions

  const headerCommonOpen = () => {
    const classReady = 'is-ready';
    const classActive = 'is-active';
    const header = $('header');
    const navigationSitemap = header.find('.navigation-header-sitemap');
    const buttonBurger = header.find('.button-header-burger');
    header.addClass(classReady);
    header.addClass(classActive);
    navigationSitemap.addClass(classReady);
    navigationSitemap.addClass(classActive);
    navigationSitemap.stop().slideDown(300);
    buttonBurger.addClass(classReady);
    buttonBurger.addClass(classActive);
    if (isWindowFrozen === false) {
      frozeWindow(true, navigationSitemap);
    }
    isHeaderActive = true;
  };

  const headerCommonClose = () => {
    const classReady = 'is-ready';
    const classActive = 'is-active';
    const header = $('header');
    const navigationSitemap = header.find('.navigation-header-sitemap');
    const buttonBurger = header.find('.button-header-burger');
    header.addClass(classReady);
    header.removeClass(classActive);
    navigationSitemap.addClass(classReady);
    navigationSitemap.removeClass(classActive);
    buttonBurger.addClass(classReady);
    buttonBurger.removeClass(classActive);
    if (isWindowFrozen === true) {
      frozeWindow(false);
    }
    isHeaderActive = false;
  };

  const headerCommon = () => {
    const classReady = 'is-ready';
    const classActive = 'is-active';
    const classScrolled = 'is-scrolled';
    const header = $('header');
    const navigationSitemap = header.find('.navigation-header-sitemap');
    const buttonBurger = header.find('.button-header-burger');
    if (!$('header').length) {
      return;
    }
    buttonBurger.on('click', () => {
      if (!buttonBurger.hasClass(classActive)) {
        headerCommonOpen();
      } else {
        headerCommonClose();
      }
    });
    $(window).on('load scroll resize', () => {
      if ($(document).scrollTop() > 1) {
        header.addClass(classScrolled);
      } else {
        header.removeClass(classScrolled);
      }
    });
    $(window).on('resize', () => {
      header.removeClass(classReady);
      navigationSitemap.removeClass(classReady);
      buttonBurger.removeClass(classReady);

      if ($(document).innerWidth() > 1099) {
        if (isHeaderActive) {
          frozeWindow(false);
        }
      } else if (isHeaderActive && !isWindowFrozen) {
        frozeWindow(true, navigationSitemap);
      }
    });
    header.addClass(classReady);
    navigationSitemap.addClass(classReady);
    buttonBurger.addClass(classReady);
  };

  const smoothScroll = () => {
    const anchors = $('a[href*="#"]:not([href="#"])');
    const speed = 500;
    let delay = 0;
    let timeout = 0;
    const getPosition = (target) => {
      let position = $(target).offset().top;
      const positionOffset = 0;
      if ($(target).attr('data-smoothscroll-offset') !== undefined) {
        position += parseInt($(target).attr('data-smoothscroll-offset'), 10);
      } else if (
        $(target).attr('data-smoothscroll-offset-pc') !== undefined &&
        !isMobile()
      ) {
        position += parseInt($(target).attr('data-smoothscroll-offset-pc'), 10);
      } else if (
        $(target).attr('data-smoothscroll-offset-sp') !== undefined &&
        isMobile()
      ) {
        position +=
          parseFloat($(target).attr('data-smoothscroll-offset-sp')) *
          $('html').css('font-size');
      }
      position -= positionOffset;
      return position;
    };
    const triggerScroll = (context) => {
      const href =
        typeof context === 'string' ?
          context : '#' + $(context).attr('href').split('#')[1];
      if (!$(context).hasClass('no-scroll') && $(href).length) {
        if (isHeaderActive === true) {
          delay = 500;
          headerCommonClose();
        }
        if (isWindowFrozen === true) {
          delay = 500;
          frozeWindow(false);
        }
        setTimeout(() => {
          $('body, html').animate(
            { scrollTop: getPosition($(href)) },
            speed,
            'swing'
          );
        }, delay);
        window.history.replaceState(null, '', $(context).attr('href'));
        return false;
      }
      return true;
    };
    setTimeout(() => {
      window.scroll(0, 0);
      $('html').removeClass('is-loading').addClass('is-visible');
    }, 1);
    if (window.location.hash) {
      window.scroll(0, 0);
      if (
        navigator.userAgent.indexOf('MSIE ') > -1 ||
        navigator.userAgent.indexOf('Trident/') > -1
      ) {
        timeout = 0;
      } else {
        timeout = 500;
      }
      setTimeout(() => {
        triggerScroll(window.location.hash);
      }, timeout);
    }
    anchors.on('click', (event) => triggerScroll(event.target.closest('a[href*="#"]:not([href="#"])')));
  };

  const sliderKeyvisual = () => {
    const classReady = 'is-ready';
    if (!$('.js-slider-keyvisual').length) {
      return;
    }
    $('.js-slider-keyvisual').each((_index, target) => {
      const slider = $(target);
      const sliderViewport = slider.find('.swiper');
      new Swiper(sliderViewport[0], {
        loop: true,
        speed: 3000,
        effect: 'fade',
        fadeEffect: {
          crossFade: true
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true
        },
        autoplay: {
          delay: 3000,
          disableOnInteraction: false
        }
      });
      slider.addClass(classReady);
    });
  };

  const galleryLinking = () => {
    const classReady = 'is-ready';
    if (!$('.js-gallery').length) {
      return;
    }
    $('.js-gallery').each((_index, target) => {
      const gallery = $(target);
      const galleryViewport = gallery.find('.swiper');
      const gallerySlides = galleryViewport.find('.swiper-slide');
      const galleryProgressBar = gallery.find(
        '[data-gallery-role="progress-bar"]'
      );
      let galleryInstance = null;
      const gallerySettingsViewPC =
        parseFloat(gallery.attr('data-gallery-view-pc')) || 1;
      const gallerySettingsViewSP =
        parseFloat(gallery.attr('data-gallery-view-sp')) || 1;
      const galleryMode = gallery.attr('data-gallery-mode');
      const galleryLoop =
        gallery.attr('data-gallery-loop') === 'false' ? false : true || true;
      const gallerySettings = {
        loop: galleryLoop,
        speed: 500,
        slidesPerView: gallerySettingsViewSP,
        slidesPerGroup: 1,
        slidesPerGroupSkip: 0,
        autoplay: {
          delay: 5000,
          disableOnInteraction: false
        },
        navigation: {
          nextEl: gallery.find('[data-gallery-role="arrow-next"]')[0],
          prevEl: gallery.find('[data-gallery-role="arrow-previous"]')[0]
        },
        on: {
          autoplayTimeLeft: (_swiper, _time, progress) => {
            if (galleryViewport.hasClass('swiper-initialized')) {
              galleryProgressBar.css('width', 100 - progress * 100 + '%');
            }
          },
          slideChangeTransitionStart: () => {
            if (galleryViewport.hasClass('swiper-initialized')) {
              galleryProgressBar.css('width', '0%');
            }
          }
        },
        breakpoints: {
          768: {
            slidesPerView: gallerySettingsViewPC
          }
        }
      };
      const isModeOnlySP = galleryMode === 'sp-only';
      let resizeTimeout;
      const initializeSwiper = () => {
        if (!galleryViewport.hasClass('swiper-initialized')) {
          galleryInstance = new Swiper(galleryViewport[0], gallerySettings);
        }
      };
      const destroySwiper = () => {
        if (galleryInstance && galleryViewport.hasClass('swiper-initialized')) {
          galleryInstance.destroy(true, true);
          galleryInstance = null;
        }
      };
      const toggleSlider = () => {
        if (isMobile()) {
          initializeSwiper();
        } else {
          destroySwiper();
        }
      };
      if (
        (gallerySlides.length === gallerySettingsViewPC ||
          gallerySlides.length === gallerySettingsViewSP) &&
        galleryLoop === true
      ) {
        gallerySlides
          .clone()
          .addClass('is-cloned')
          .appendTo(gallery.find('.swiper-wrapper'));
      }
      if (isModeOnlySP) {
        toggleSlider();
        $(window).on('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            toggleSlider();
          }, 200);
        });
      } else {
        galleryInstance = new Swiper(galleryViewport[0], gallerySettings);
        gallery.find('.js-video-behavior').each((_index, target) => {
          const video = $(target);
          const videoSource = video.find('video');
          galleryInstance.on('transitionStart', () => {
            videoSource[0].pause();
          });
          videoSource[0].addEventListener('play', () => {
            galleryInstance.autoplay.pause();
          });
          videoSource[0].addEventListener('pause', () => {
            galleryInstance.autoplay.resume();
          });
          videoSource[0].addEventListener('ended', () => {
            galleryInstance.autoplay.resume();
          });
        });
      }
      gallery.addClass(classReady);
    });
  };

  const lightboxLinking = () => {
    const classReady = 'is-ready';
    const classActive = 'is-active';
    const lightbox = $('.js-lightbox[data-lightbox-role="modal"]');
    const buttonOpen = $('.js-lightbox[data-lightbox-role="button-open"]');
    const buttonClose = lightbox.find('[data-lightbox-role="button-close"]');
    if (!$('.js-lightbox[data-lightbox-role="modal"]').length) {
      return;
    }
    buttonOpen.on('click', (event) => {
      const button = $(event.target.closest('.js-lightbox[data-lightbox-role="button-open"]'));
      const lightboxID = button.attr('data-lightbox-id');
      if (isWindowFrozen === false) {
        frozeWindow(true, $('.js-lightbox[data-lightbox-role="modal"]'));
      }
      lightbox
        .find(
          '[data-lightbox-role="modal-frame"][data-lightbox-id="' +
          lightboxID +
          '"]'
        )
        .addClass(classActive);
      lightbox.addClass(classReady).addClass(classActive);
      lightbox.show().scrollTop(0).hide();
      lightbox.stop().fadeIn({
        duration: 500,
        easing: 'swing'
      });
    });
    buttonClose.on('click', () => {
      lightbox.addClass(classReady).removeClass(classActive);
      lightbox.stop().fadeOut({
        duration: 500,
        easing: 'swing',
        complete: () => {
          lightbox
            .find('[data-lightbox-role="modal-frame"]')
            .removeClass(classActive);
        }
      });
      if (isWindowFrozen === true) {
        frozeWindow(false);
      }
    });
    $(window).on('load resize', () => {
      lightbox.removeClass(classReady);
    });
    lightbox.addClass(classReady);
  };

  const widthScreen = () => {
    if (!$('.js-width-screen').length) {
      return;
    }
    const setWidth = () => {
      $('.js-width-screen').css(
        'max-width',
        'calc(100dvw - ' +
        (window.innerWidth - document.documentElement.clientWidth) +
        'px)'
      );
    };
    setWidth();
    $(window).on('resize', () => {
      setWidth();
    });
  };

  $(window).on('load scroll resize', () => {
    pageOffsetX = $(window).scrollLeft();
    if (isWindowFrozen === true) {
      scrollFix($('body'));
    }
  });

  document.addEventListener('wpcf7mailsent', function () {
    window.location.href = '../thanks/';
  }, false);

  $(() => {
    detectBrowser();
    detectDevice();
    scrollLeft();
    headerCommon();
    smoothScroll();
    sliderKeyvisual();
    galleryLinking();
    lightboxLinking();
    widthScreen();
  });
})();

// ==============================================
// FAQ Functionality
// ==============================================

document.addEventListener('DOMContentLoaded', function() {
  
  // Tab switching
  const faqTabs = document.querySelectorAll('.faq-tab');
  const faqContents = document.querySelectorAll('.faq-content');
  
  faqTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      
      // Remove active class from all tabs
      faqTabs.forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Hide all content
      faqContents.forEach(content => content.classList.remove('active'));
      // Show selected content
      const activeContent = document.querySelector(`.faq-content[data-category="${category}"]`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });
  
  // Accordion functionality
  const faqQuestions = document.querySelectorAll('.faq-question');
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', function() {
      const faqItem = this.parentElement;
      const answer = faqItem.querySelector('.faq-answer');
      const answerContent = answer.querySelector('.answer-content');
      
      // Toggle active class
      const isActive = faqItem.classList.contains('active');
      
      if (isActive) {
        // Close
        faqItem.classList.remove('active');
        answer.style.maxHeight = '0';
      } else {
        // Open
        faqItem.classList.add('active');
        answer.style.maxHeight = answerContent.scrollHeight + 'px';
      }
    });
  });
  
});

