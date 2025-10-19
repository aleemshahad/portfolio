# 🚀 GitHub Pages Deployment Guide

This guide will help you deploy your advanced portfolio website to GitHub Pages.

## 📋 Prerequisites

- GitHub account
- Git installed on your computer
- Basic knowledge of Git commands

## 🔧 Setup Instructions

### 1. Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click "New repository" or go to https://github.com/new
3. Repository name: `portfolio` (or any name you prefer)
4. Make it **Public** (required for free GitHub Pages)
5. Check "Add a README file"
6. Click "Create repository"

### 2. Clone and Upload Your Files

```bash
# Clone your new repository
git clone https://github.com/YOUR_USERNAME/portfolio.git

# Navigate to the repository folder
cd portfolio

# Copy all your portfolio files to this folder
# (index.html, blog.html, assets folder, etc.)

# Add all files to git
git add .

# Commit the changes
git commit -m "Initial portfolio website"

# Push to GitHub
git push origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Under **Build and deployment**:
   - Source: Deploy from a branch
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
5. Click **Save**

### 4. Access Your Website

Your website will be available at:
```
https://YOUR_USERNAME.github.io/portfolio
```

**Note**: It may take a few minutes for the site to be live.

## 🛠️ Advanced Configuration

### Custom Domain (Optional)

1. Buy a domain from any domain registrar
2. In your repository, create a file named `CNAME` with your domain:
   ```
   yourdomain.com
   ```
3. Configure DNS settings with your domain provider:
   - Add CNAME record pointing to `YOUR_USERNAME.github.io`

### SSL Certificate

GitHub Pages automatically provides SSL certificates for `.github.io` domains and custom domains.

## 📁 File Structure

Your repository should look like this:

```
portfolio/
├── index.html
├── blog.html
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
│       └── (your images)
├── _config.yml
├── package.json
├── README.md
├── DEPLOYMENT.md
└── .github/
    └── workflows/
        └── deploy.yml
```

## 🔄 Updating Your Website

To update your website:

```bash
# Make your changes to the files
# Then commit and push:

git add .
git commit -m "Update website content"
git push origin main
```

Changes will be live within a few minutes.

## 🎨 Customization Tips

### 1. Update Personal Information

Edit these files with your information:
- `index.html` - Update name, bio, skills, services
- `blog.html` - Add your articles and content
- `assets/js/main.js` - Update contact information

### 2. Add Your Images

1. Add your profile photo to `assets/images/profile.jpg`
2. Add project screenshots to `assets/images/`
3. Update image paths in HTML files

### 3. Customize Colors and Styling

The website uses Tailwind CSS. You can customize:
- Colors: Change `blue-400`, `gray-900`, etc. in HTML files
- Animations: Modify `assets/css/style.css`
- Layout: Adjust Tailwind classes in HTML

### 4. Add Real Content

Replace placeholder content with:
- Your actual projects and portfolio items
- Real blog articles
- Your contact information
- Social media links

## 📊 Analytics and SEO

### Google Analytics

1. Get your Google Analytics tracking ID
2. Replace `UA-XXXXXXXXX-X` in `_config.yml`
3. Add tracking code to your HTML files

### SEO Optimization

The website includes:
- Meta descriptions
- Open Graph tags
- Structured data
- Sitemap generation
- Mobile-friendly design

## 🔍 Troubleshooting

### Common Issues

1. **Site not loading**: Check if GitHub Pages is enabled in repository settings
2. **404 errors**: Ensure `index.html` is in the root directory
3. **CSS not loading**: Check file paths and case sensitivity
4. **Images not showing**: Verify image paths and file extensions

### Build Errors

If you see build errors:
1. Check the Actions tab in your GitHub repository
2. Look for error messages in the deployment logs
3. Ensure all file paths are correct
4. Validate your HTML and CSS

## 📞 Support

If you need help:
1. Check GitHub Pages documentation
2. Review the repository issues
3. Contact the developer

## 🎉 Success!

Once deployed, your portfolio will be:
- ✅ Live on the internet
- ✅ Mobile-responsive
- ✅ SEO-optimized
- ✅ Fast loading
- ✅ Professional looking

Share your portfolio URL with potential clients and employers!

---

**Built with ❤️ by Muhammad Aleem Shahzad**
