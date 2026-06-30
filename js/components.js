async function loadPartial(url, placeholderId) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const html = await res.text();
    placeholder.outerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPartial('partials/footer.html', 'footer-placeholder');
});

// Page-leave transition: show loader before navigating to internal links
document.addEventListener('click', function (e) {
  var anchor = e.target.closest('a');
  if (!anchor) return;

  var href = anchor.getAttribute('href');
  if (!href) return;

  // Only handle internal page navigations (not hash links, mailto, tel, external)
  var isInternal = !/^(https?:|mailto:|tel:|#|javascript:)/i.test(href);
  if (!isInternal) return;
  if (anchor.target === '_blank') return;

  e.preventDefault();

  var holder = document.getElementById('loading_holder');
  if (holder) {
    holder.style.opacity = '1';
    holder.style.transition = 'opacity 0.25s ease';
    holder.style.display = 'flex';
  }

  setTimeout(function () {
    window.location.href = href;
  }, 250);
});

function bodyLoad() {
  var minDelay = new Promise(function (resolve) { setTimeout(resolve, 500); });

  var images = Array.from(document.images);
  var imagePromises = images.map(function (img) {
    return new Promise(function (resolve) {
      if (img.complete) { resolve(); return; }
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve); // don't block on broken images
    });
  });

  Promise.all([minDelay].concat(imagePromises)).then(function () {
    var holder = document.getElementById('loading_holder');
    if (!holder) return;
    holder.style.opacity = '0';
    holder.style.transition = 'opacity 0.4s ease';
    setTimeout(function () {
      holder.style.display = 'none';
      var body = document.querySelector('.body');
      if (body) body.style.display = 'block';
      window.dispatchEvent(new CustomEvent('bodyshown'));
      
      // Handle hash navigation after body is visible
      if (window.location.hash) {
        var target = document.querySelector(window.location.hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 400);
  });
}
