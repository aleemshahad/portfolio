// Advanced Portfolio JavaScript

// Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', function() {
    AOS.init({
        duration: 1000,
        easing: 'ease-in-out',
        once: true,
        mirror: false
    });
});

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.createElement('div');
mobileMenu.className = 'mobile-menu fixed top-0 left-0 w-full h-full bg-gray-900 z-40 md:hidden';
mobileMenu.innerHTML = `
    <div class="flex flex-col items-center justify-center h-full space-y-8 text-2xl">
        <a href="#home" class="text-white hover:text-blue-400 transition-colors">Home</a>
        <a href="#about" class="text-white hover:text-blue-400 transition-colors">About</a>
        <a href="#skills" class="text-white hover:text-blue-400 transition-colors">Skills</a>
        <a href="#services" class="text-white hover:text-blue-400 transition-colors">Services</a>
        <a href="#blog" class="text-white hover:text-blue-400 transition-colors">Blog</a>
        <a href="#contact" class="text-white hover:text-blue-400 transition-colors">Contact</a>
        <button id="close-mobile-menu" class="text-white text-3xl">
            <i class="fas fa-times"></i>
        </button>
    </div>
`;

document.body.appendChild(mobileMenu);

mobileMenuBtn.addEventListener('click', function() {
    mobileMenu.classList.add('active');
});

document.getElementById('close-mobile-menu').addEventListener('click', function() {
    mobileMenu.classList.remove('active');
});

// Close mobile menu when clicking on links
mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', function() {
        mobileMenu.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Active navigation highlighting
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('text-blue-400');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('text-blue-400');
        }
    });
});

// Typing animation for hero section
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Initialize typing animation when page loads
window.addEventListener('load', function() {
    const heroTitle = document.querySelector('#home h1');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        typeWriter(heroTitle, originalText, 50);
    }
});

// Skill bars animation
function animateSkillBars() {
    const skillBars = document.querySelectorAll('.skill-bar div');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bar = entry.target;
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => {
                    bar.style.transition = 'width 2s ease-in-out';
                    bar.style.width = width;
                }, 100);
            }
        });
    }, { threshold: 0.5 });

    skillBars.forEach(bar => observer.observe(bar));
}

// Initialize skill bars animation
animateSkillBars();

// Contact form handling
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const name = formData.get('name') || this.querySelector('input[placeholder="Your Name"]').value;
        const email = formData.get('email') || this.querySelector('input[placeholder="Your Email"]').value;
        const subject = formData.get('subject') || this.querySelector('input[placeholder="Subject"]').value;
        const message = formData.get('message') || this.querySelector('textarea').value;
        
        // Basic validation
        if (!name || !email || !message) {
            showNotification('Please fill in all required fields.', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        // Simulate form submission (replace with actual email service)
        setTimeout(() => {
            showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
            this.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    });
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
    
    const bgColor = type === 'success' ? 'bg-green-600' : 
                   type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    
    notification.classList.add(bgColor);
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}-circle"></i>
            <span class="text-white">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Parallax scrolling effect
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.parallax');
    
    parallaxElements.forEach(element => {
        const speed = 0.5;
        const yPos = -(scrolled * speed);
        element.style.transform = `translateY(${yPos}px)`;
    });
});

// Loading screen
function showLoadingScreen() {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.className = 'fixed inset-0 bg-gray-900 flex items-center justify-center z-50';
    loadingScreen.innerHTML = `
        <div class="text-center">
            <div class="loading-spinner mx-auto mb-4"></div>
            <p class="text-white text-lg">Loading...</p>
        </div>
    `;
    
    document.body.appendChild(loadingScreen);
    
    // Hide loading screen when page is fully loaded
    window.addEventListener('load', function() {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.remove(), 500);
        }, 1000);
    });
}

// Initialize loading screen
// showLoadingScreen();

// Dark mode toggle (optional feature)
function createDarkModeToggle() {
    const toggle = document.createElement('button');
    toggle.className = 'dark-mode-toggle no-print';
    toggle.innerHTML = '<i class="fas fa-moon"></i>';
    toggle.title = 'Toggle Dark Mode';
    
    toggle.addEventListener('click', function() {
        document.body.classList.toggle('light-mode');
        const icon = this.querySelector('i');
        icon.className = document.body.classList.contains('light-mode') ? 
                        'fas fa-sun' : 'fas fa-moon';
    });
    
    document.body.appendChild(toggle);
}

// Initialize dark mode toggle
createDarkModeToggle();

// Scroll to top functionality
function createScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all duration-300 opacity-0 pointer-events-none z-40';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollBtn.title = 'Scroll to Top';
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollBtn.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            scrollBtn.classList.add('opacity-0', 'pointer-events-none');
        }
    });
    
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    document.body.appendChild(scrollBtn);
}

// Initialize scroll to top
createScrollToTop();

// Performance optimization: Lazy loading for images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Initialize lazy loading
lazyLoadImages();

// Analytics tracking (placeholder)
function trackEvent(category, action, label) {
    // Replace with your analytics tracking code
    console.log(`Analytics: ${category} - ${action} - ${label}`);
}

// Track navigation clicks
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', function() {
        trackEvent('Navigation', 'Click', this.textContent);
    });
});

// Track button clicks
document.querySelectorAll('button, .btn').forEach(button => {
    button.addEventListener('click', function() {
        trackEvent('Button', 'Click', this.textContent || this.title);
    });
});

// Console welcome message
console.log(`
🚀 Welcome to Muhammad Aleem Shahzad's Portfolio!
💼 Digital Marketing Expert | SEO Specialist | Python Automation Developer
🌐 Built with modern web technologies
📧 Contact: aleemshahzad@email.com

Thanks for checking out the code! 😊
`);

// Service Worker registration (for PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed');
            });
    });
}
