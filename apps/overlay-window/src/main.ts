/**
 * Initialize the application
 */
async function initializeApp() {
  // Create video element
  console.log('Initializing app');
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.src = './big-buck-bunny_trailer (1).webm';
  video.style.width = '600px';
  video.style.height = '400px';
  video.style.objectFit = 'cover';

  // Add video to document body
  document.body.appendChild(video);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
