// Theme Management - Update back button styling based on current theme
// Theme is already set by inline script in <head>, just update the back button
(function() {
    function updateBackButton() {
        const backButton = document.getElementById('backButton');
        if (backButton) {
            const isNight = document.body.classList.contains('theme-night');
            if (isNight) {
                backButton.classList.add('night-mode');
            } else {
                backButton.classList.remove('night-mode');
            }
        }
    }

    // Update back button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateBackButton);
    } else {
        updateBackButton();
    }

    // Hide theme toggle button (use main site's preference only)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.style.display = 'none';
            }
        });
    } else {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.style.display = 'none';
        }
    }
})();

// Mobile Navigation Toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    
    // Animate hamburger icon
    const spans = navToggle.querySelectorAll('span');
    if (navMenu.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
    } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    }
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
    });
});

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Form submission
const appointmentForm = document.getElementById('appointment-form');

appointmentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(appointmentForm);
    const data = Object.fromEntries(formData);
    
    // Here you would typically send the data to a server
    // For now, we'll just show an alert
    alert('Thank you for your appointment request! We will contact you shortly to confirm your booking.');
    
    // Reset form
    appointmentForm.reset();
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards
document.querySelectorAll('.service-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

// Observe gallery items
document.querySelectorAll('.gallery-item').forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(30px)';
    item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(item);
});

// Add stagger delay to service cards
document.querySelectorAll('.service-card').forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.1}s`;
});

// Add stagger delay to gallery items
document.querySelectorAll('.gallery-item').forEach((item, index) => {
    item.style.transitionDelay = `${index * 0.1}s`;
});

// Design Theme Toggle
const designToggle = document.getElementById('designToggle');
const body = document.body;
const designNumber = document.getElementById('designNumber');

// Define theme order
const themes = ['modern', 'classic', 'vintage', 'minimalist', 'luxury', 'apple', 'stark', 'disney', 'creative', 'stark-creative', 'experimental', 'isometric', 'liquid', 'interactive', 'facebook', 'dark', 'words', 'words-classic', 'words-aesthetic', 'chaos', 'terminal', 'experimental-rules', 'conversion', 'clean-conversion', 'minimal-conversion', 'jungle'];

// Check for saved theme preference or default to modern
const currentTheme = localStorage.getItem('theme') || 'modern';
body.className = `theme-${currentTheme}`;

// Initialize design number
let currentThemeIndex = themes.indexOf(currentTheme);
if (currentThemeIndex === -1) currentThemeIndex = 0;
designNumber.textContent = (currentThemeIndex + 1).toString().padStart(2, '0');

designToggle.addEventListener('click', () => {
    // Cycle through themes: modern -> classic -> vintage -> minimalist -> luxury -> apple -> stark -> disney -> creative -> stark-creative -> experimental -> modern
    if (body.classList.contains('theme-modern')) {
        body.classList.remove('theme-modern');
        body.classList.add('theme-classic');
        localStorage.setItem('theme', 'classic');
    } else if (body.classList.contains('theme-classic')) {
        body.classList.remove('theme-classic');
        body.classList.add('theme-vintage');
        localStorage.setItem('theme', 'vintage');
    } else if (body.classList.contains('theme-vintage')) {
        body.classList.remove('theme-vintage');
        body.classList.add('theme-minimalist');
        localStorage.setItem('theme', 'minimalist');
    } else if (body.classList.contains('theme-minimalist')) {
        body.classList.remove('theme-minimalist');
        body.classList.add('theme-luxury');
        localStorage.setItem('theme', 'luxury');
    } else if (body.classList.contains('theme-luxury')) {
        body.classList.remove('theme-luxury');
        body.classList.add('theme-apple');
        localStorage.setItem('theme', 'apple');
    } else if (body.classList.contains('theme-apple')) {
        body.classList.remove('theme-apple');
        body.classList.add('theme-stark');
        localStorage.setItem('theme', 'stark');
    } else if (body.classList.contains('theme-stark')) {
        body.classList.remove('theme-stark');
        body.classList.add('theme-disney');
        localStorage.setItem('theme', 'disney');
    } else if (body.classList.contains('theme-disney')) {
        body.classList.remove('theme-disney');
        body.classList.add('theme-creative');
        localStorage.setItem('theme', 'creative');
    } else if (body.classList.contains('theme-creative')) {
        body.classList.remove('theme-creative');
        body.classList.add('theme-stark-creative');
        localStorage.setItem('theme', 'stark-creative');
    } else if (body.classList.contains('theme-stark-creative')) {
        body.classList.remove('theme-stark-creative');
        body.classList.add('theme-experimental');
        localStorage.setItem('theme', 'experimental');
    } else if (body.classList.contains('theme-experimental')) {
        body.classList.remove('theme-experimental');
        body.classList.add('theme-isometric');
        localStorage.setItem('theme', 'isometric');
    } else if (body.classList.contains('theme-isometric')) {
        body.classList.remove('theme-isometric');
        body.classList.add('theme-liquid');
        localStorage.setItem('theme', 'liquid');
    } else if (body.classList.contains('theme-liquid')) {
        body.classList.remove('theme-liquid');
        body.classList.add('theme-interactive');
        localStorage.setItem('theme', 'interactive');
    } else if (body.classList.contains('theme-interactive')) {
        body.classList.remove('theme-interactive');
        body.classList.add('theme-facebook');
        localStorage.setItem('theme', 'facebook');
    } else if (body.classList.contains('theme-facebook')) {
        body.classList.remove('theme-facebook');
        body.classList.add('theme-dark');
        localStorage.setItem('theme', 'dark');
    } else if (body.classList.contains('theme-dark')) {
        body.classList.remove('theme-dark');
        body.classList.add('theme-words');
        localStorage.setItem('theme', 'words');
    } else if (body.classList.contains('theme-words')) {
        body.classList.remove('theme-words');
        body.classList.add('theme-words-classic');
        localStorage.setItem('theme', 'words-classic');
    } else if (body.classList.contains('theme-words-classic')) {
        body.classList.remove('theme-words-classic');
        body.classList.add('theme-words-aesthetic');
        localStorage.setItem('theme', 'words-aesthetic');
    } else if (body.classList.contains('theme-words-aesthetic')) {
        body.classList.remove('theme-words-aesthetic');
        body.classList.add('theme-chaos');
        localStorage.setItem('theme', 'chaos');
    } else if (body.classList.contains('theme-chaos')) {
        body.classList.remove('theme-chaos');
        body.classList.add('theme-terminal');
        localStorage.setItem('theme', 'terminal');
    } else if (body.classList.contains('theme-terminal')) {
        body.classList.remove('theme-terminal');
        body.classList.add('theme-experimental-rules');
        localStorage.setItem('theme', 'experimental-rules');
    } else if (body.classList.contains('theme-experimental-rules')) {
        body.classList.remove('theme-experimental-rules');
        body.classList.add('theme-conversion');
        localStorage.setItem('theme', 'conversion');
    } else if (body.classList.contains('theme-conversion')) {
        body.classList.remove('theme-conversion');
        body.classList.add('theme-clean-conversion');
        localStorage.setItem('theme', 'clean-conversion');
    } else if (body.classList.contains('theme-clean-conversion')) {
        body.classList.remove('theme-clean-conversion');
        body.classList.add('theme-minimal-conversion');
        localStorage.setItem('theme', 'minimal-conversion');
    } else if (body.classList.contains('theme-minimal-conversion')) {
        body.classList.remove('theme-minimal-conversion');
        body.classList.add('theme-jungle');
        localStorage.setItem('theme', 'jungle');
    } else {
        body.classList.remove('theme-jungle');
        body.classList.add('theme-modern');
        localStorage.setItem('theme', 'modern');
    }
    
    // Update design number
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    designNumber.textContent = (currentThemeIndex + 1).toString().padStart(2, '0');
    
    // Close gallery if open when switching themes
    const galleryModal = document.getElementById('galleryModal');
    if (galleryModal) {
        galleryModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    // Scroll to top for better visual transition
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Close mobile menu if open
    navMenu.classList.remove('active');
    const spans = navToggle.querySelectorAll('span');
    spans[0].style.transform = 'none';
    spans[1].style.opacity = '1';
    spans[2].style.transform = 'none';
});

// Gallery Modal for Terminal Theme
const galleryModal = document.getElementById('galleryModal');
let galleryItems = document.querySelectorAll('.gallery-item');
let galleryThumbs = document.querySelectorAll('.gallery-thumb');
const galleryMainImg = document.getElementById('galleryMainImg');
const galleryClose = document.querySelector('.gallery-close');
const galleryPrev = document.querySelector('.gallery-prev');
const galleryNext = document.querySelector('.gallery-next');
const galleryCurrent = document.getElementById('galleryCurrent');
const galleryTotal = document.getElementById('galleryTotal');

let currentImageIndex = 0;
const galleryImages = [
    'barber_interior_chairs_farshot.png',
    'far_shot_interior.png',
    'barber_cut_closeshot.png',
    'barber_midshot.png',
    'barber_supercloseshot.png',
    'cut_midshot.jpg'
];

// Store event handlers so we can remove them
let galleryItemHandlers = [];
let galleryThumbHandlers = [];
let galleryCloseHandler = null;
let galleryPrevHandler = null;
let galleryNextHandler = null;
let galleryKeyHandler = null;
let galleryModalHandler = null;

// Enable gallery for terminal, modern, classic, vintage, and minimalist themes
function initGallery() {
    if (!document.body.classList.contains('theme-terminal') && !document.body.classList.contains('theme-modern') && !document.body.classList.contains('theme-classic') && !document.body.classList.contains('theme-vintage') && !document.body.classList.contains('theme-minimalist')) {
        return;
    }

    // Remove old event listeners first
    galleryItems.forEach((item, index) => {
        if (galleryItemHandlers[index]) {
            item.removeEventListener('click', galleryItemHandlers[index]);
        }
    });
    galleryItemHandlers = [];

    // Remove old thumb handlers
    galleryThumbs.forEach((thumb, index) => {
        if (galleryThumbHandlers[index]) {
            thumb.removeEventListener('click', galleryThumbHandlers[index]);
        }
    });
    galleryThumbHandlers = [];

    // Remove old button handlers
    if (galleryClose && galleryCloseHandler) {
        galleryClose.removeEventListener('click', galleryCloseHandler);
    }
    if (galleryPrev && galleryPrevHandler) {
        galleryPrev.removeEventListener('click', galleryPrevHandler);
    }
    if (galleryNext && galleryNextHandler) {
        galleryNext.removeEventListener('click', galleryNextHandler);
    }

    // Remove old keyboard handler
    if (galleryKeyHandler) {
        document.removeEventListener('keydown', galleryKeyHandler);
    }

    // Remove old modal click handler
    if (galleryModal && galleryModalHandler) {
        galleryModal.removeEventListener('click', galleryModalHandler);
    }

    // Query fresh elements
    galleryItems = document.querySelectorAll('.gallery-item');
    galleryThumbs = document.querySelectorAll('.gallery-thumb');

    // Add new event listeners
    galleryItems.forEach((item, index) => {
        item.style.cursor = 'pointer';
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openGallery(index);
        };
        galleryItemHandlers[index] = handler;
        item.addEventListener('click', handler);
    });

    if (galleryThumbs.length > 0) {
        galleryThumbs.forEach((thumb, index) => {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                currentImageIndex = index;
                updateGallery();
            };
            galleryThumbHandlers[index] = handler;
            thumb.addEventListener('click', handler);
        });
    }

    if (galleryClose) {
        galleryCloseHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeGallery();
        };
        galleryClose.addEventListener('click', galleryCloseHandler);
    }

    if (galleryPrev) {
        galleryPrevHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
            updateGallery();
        };
        galleryPrev.addEventListener('click', galleryPrevHandler);
    }

    if (galleryNext) {
        galleryNextHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
            updateGallery();
        };
        galleryNext.addEventListener('click', galleryNextHandler);
    }

    // Close on escape key
    galleryKeyHandler = (e) => {
        if (e.key === 'Escape' && galleryModal && galleryModal.classList.contains('active')) {
            closeGallery();
        }
        if (e.key === 'ArrowLeft' && galleryModal && galleryModal.classList.contains('active')) {
            e.preventDefault();
            currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
            updateGallery();
        }
        if (e.key === 'ArrowRight' && galleryModal && galleryModal.classList.contains('active')) {
            e.preventDefault();
            currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
            updateGallery();
        }
    };
    document.addEventListener('keydown', galleryKeyHandler);

    // Close on background click
    if (galleryModal) {
        galleryModalHandler = (e) => {
            if (e.target === galleryModal) {
                closeGallery();
            }
        };
        galleryModal.addEventListener('click', galleryModalHandler);
    }
}

function openGallery(index) {
    if (!document.body.classList.contains('theme-terminal') && !document.body.classList.contains('theme-modern') && !document.body.classList.contains('theme-classic') && !document.body.classList.contains('theme-vintage') && !document.body.classList.contains('theme-minimalist')) {
        return;
    }
    currentImageIndex = index;
    updateGallery();
    if (galleryModal) {
        galleryModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeGallery() {
    if (galleryModal) {
        galleryModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateGallery() {
    if (galleryMainImg && galleryImages[currentImageIndex]) {
        galleryMainImg.src = galleryImages[currentImageIndex];
        galleryMainImg.alt = `Gallery Image ${currentImageIndex + 1}`;
    }
    
    if (galleryCurrent) {
        galleryCurrent.textContent = currentImageIndex + 1;
    }
    
    if (galleryThumbs.length > 0) {
        galleryThumbs.forEach((thumb, index) => {
            if (index === currentImageIndex) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }
}

// Initialize gallery on page load
initGallery();

// Re-initialize gallery when theme changes
designToggle.addEventListener('click', () => {
    setTimeout(() => {
        initGallery();
    }, 100);
});

