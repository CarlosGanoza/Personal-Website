const featuredProjectsGrid = document.getElementById("featured-projects-grid");
const additionalProjectsGrid = document.getElementById("additional-projects-grid");
const additionalProjectsSection = document.getElementById("additional-projects");
const awardsMoreToggle = document.getElementById("awards-more-toggle");
const awardsMorePanel = document.getElementById("awards-more-panel");
const backToTopButton = document.getElementById("back-to-top");

const videoModal = document.getElementById("video-modal");
const videoModalTitle = document.getElementById("video-modal-title");
const videoModalPlayer = document.getElementById("video-modal-player");
const videoModalCaption = document.getElementById("video-modal-caption");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FALLBACK_THUMBNAIL = "assets/projects/default-thumb.svg";
const FALLBACK_VIDEO_POSTER = "assets/projects/video-poster.svg";

let lastFocusedElement = null;

const buildPath = (relativePath) => {
  if (!relativePath) return "";
  if (/^(https?:)?\/\//.test(relativePath) || relativePath.startsWith("mailto:")) {
    return relativePath;
  }
  return new URL(`../${relativePath.replace(/^\.\//, "")}`, import.meta.url).href;
};

const getProjectStatus = (status) => {
  const normalized = String(status || "prototype").toLowerCase();
  if (["real", "prototype", "placeholder"].includes(normalized)) {
    return normalized;
  }
  return "prototype";
};

const getFocusableElements = (container) => {
  return [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null
  );
};

const closeVideoModal = () => {
  if (!videoModal || !videoModalPlayer) return;

  videoModalPlayer.pause();
  videoModalPlayer.removeAttribute("src");
  videoModalPlayer.removeAttribute("poster");
  videoModalPlayer.load();

  videoModal.classList.remove("is-open");
  videoModal.hidden = true;
  videoModal.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
};

const openVideoModal = (video = {}, title = "Project") => {
  if (!videoModal || !videoModalPlayer || !videoModalTitle || !video?.src) return;

  lastFocusedElement = document.activeElement;

  videoModalTitle.textContent = `${title} demo video`;
  videoModalPlayer.setAttribute("aria-label", `${title} demo video`);
  videoModalPlayer.preload = "none";
  videoModalPlayer.src = buildPath(video.src);
  videoModalPlayer.poster = buildPath(video.poster || FALLBACK_VIDEO_POSTER);
  videoModalPlayer.load();

  const captionText = video.description?.trim() || "";
  if (videoModalCaption) {
    videoModalCaption.textContent = captionText;
    videoModalCaption.hidden = !captionText;
  }

  videoModal.hidden = false;
  videoModal.removeAttribute("hidden");
  videoModal.classList.add("is-open");
  document.body.classList.add("modal-open");

  const focusableElements = getFocusableElements(videoModal);
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
};

const handleModalKeydown = (event) => {
  if (!videoModal || videoModal.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeVideoModal();
    return;
  }

  if (event.key !== "Tab") return;

  const focusableElements = getFocusableElements(videoModal);
  if (!focusableElements.length) return;

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const setupVideoModal = () => {
  if (!videoModal) return;

  videoModal.classList.remove("is-open");

  const closeControls = videoModal.querySelectorAll("[data-video-close]");
  closeControls.forEach((control) => {
    control.addEventListener("click", closeVideoModal);
  });

  videoModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const closeTarget = target.closest("[data-video-close]");
    if (closeTarget) {
      closeVideoModal();
    }
  });

  document.addEventListener("keydown", handleModalKeydown);
};

const makeMetaRow = (label, value, note) => {
  const p = document.createElement("p");
  p.className = "project-meta";

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  p.appendChild(strong);
  p.appendChild(document.createTextNode(value));

  if (note) {
    const noteSpan = document.createElement("span");
    noteSpan.className = "project-meta__note";
    noteSpan.textContent = ` (${note})`;
    p.appendChild(noteSpan);
  }

  return p;
};

const buildProjectLinks = (links = {}, title = "project") => {
  const linkEntries = [
    { key: "demo", label: "Demo" },
    { key: "github", label: "GitHub" },
    { key: "writeup", label: "Write-up" }
  ];

  const linksWrap = document.createElement("div");
  linksWrap.className = "project-links";

  linkEntries.forEach(({ key, label }) => {
    const rawValue = typeof links[key] === "string" ? links[key].trim() : "";
    if (!rawValue || rawValue === "#") return;

    const anchor = document.createElement("a");
    anchor.href = buildPath(rawValue);
    anchor.textContent = label;

    const isExternal = /^(https?:)?\/\//.test(rawValue);
    if (isExternal) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.setAttribute("aria-label", `${label} for ${title} (opens in a new tab)`);
    } else {
      anchor.setAttribute("aria-label", `${label} for ${title}`);
    }

    linksWrap.appendChild(anchor);
  });

  return linksWrap.childElementCount > 0 ? linksWrap : null;
};

const buildVideoButton = (video = {}, title = "project") => {
  if (!video?.src) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-video-btn";
  button.textContent = "View demo video";
  button.setAttribute("aria-label", `Open demo video for ${title}`);

  button.addEventListener("click", () => {
    openVideoModal(video, title);
  });

  return button;
};

const renderProjectCard = (project) => {
  const card = document.createElement("article");
  card.className = "project-card";

  const status = getProjectStatus(project.status);
  if (status === "placeholder") {
    card.classList.add("project-card--placeholder");
  }

  const thumbnailWrap = document.createElement("div");
  thumbnailWrap.className = "project-thumb";

  const thumbImg = document.createElement("img");
  thumbImg.src = buildPath(project.thumbnail || FALLBACK_THUMBNAIL);
  thumbImg.alt = `${project.title} thumbnail`;
  thumbImg.width = 640;
  thumbImg.height = 360;
  thumbImg.loading = "lazy";
  thumbImg.decoding = "async";
  thumbnailWrap.appendChild(thumbImg);
  card.appendChild(thumbnailWrap);

  const header = document.createElement("div");
  header.className = "project-card__header";

  const title = document.createElement("h3");
  title.textContent = project.title;
  header.appendChild(title);

  if (status === "placeholder") {
    const statusBadge = document.createElement("span");
    statusBadge.className = "project-status-badge";
    statusBadge.textContent = "In progress";
    header.appendChild(statusBadge);
  }

  card.appendChild(header);

  if (project.tagline) {
    const tagline = document.createElement("p");
    tagline.className = "project-tagline";
    tagline.textContent = project.tagline;
    card.appendChild(tagline);
  }

  const detailsWrap = document.createElement("div");
  detailsWrap.className = "project-details";

  if (project.problem) {
    detailsWrap.appendChild(makeMetaRow("Problem", project.problem));
  }

  if (project.built) {
    detailsWrap.appendChild(makeMetaRow("What I built", project.built));
  }

  const resultText = status === "placeholder" ? "Early prototype; results pending." : project.result;
  const metricsNote = project.metrics_note || "";

  if (resultText) {
    detailsWrap.appendChild(makeMetaRow("Result", resultText, metricsNote));
  }

  if (detailsWrap.childElementCount > 0) {
    card.appendChild(detailsWrap);

    const moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.className = "project-more-btn";
    moreButton.textContent = "More";
    moreButton.setAttribute("aria-expanded", "false");
    moreButton.setAttribute("aria-label", `Expand details for ${project.title}`);

    moreButton.addEventListener("click", () => {
      const isExpanded = card.classList.toggle("is-expanded");
      moreButton.textContent = isExpanded ? "Less" : "More";
      moreButton.setAttribute("aria-expanded", String(isExpanded));
      moreButton.setAttribute(
        "aria-label",
        `${isExpanded ? "Collapse" : "Expand"} details for ${project.title}`
      );
    });

    card.appendChild(moreButton);
  }

  if (Array.isArray(project.stack) && project.stack.length > 0) {
    const stackList = document.createElement("ul");
    stackList.className = "stack-list";

    project.stack.forEach((stackItem) => {
      const li = document.createElement("li");
      li.textContent = stackItem;
      stackList.appendChild(li);
    });

    card.appendChild(stackList);
  }

  const footer = document.createElement("div");
  footer.className = "project-footer";

  const videoButton = buildVideoButton(project.video, project.title);
  const linksWrap = buildProjectLinks(project.links, project.title);

  if (videoButton) {
    footer.appendChild(videoButton);
  }

  if (linksWrap) {
    footer.appendChild(linksWrap);
  }

  if (footer.childElementCount > 0) {
    card.appendChild(footer);
  }

  return card;
};

const renderProjects = async () => {
  if (!featuredProjectsGrid || !additionalProjectsGrid) return;

  try {
    const dataUrl = new URL("../data/projects.json", import.meta.url);
    const response = await fetch(dataUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Could not load projects: ${response.status}`);
    }

    const json = await response.json();
    const allProjects = Array.isArray(json.projects) ? json.projects : [];

    const featured = allProjects.filter((project) => project.featured).slice(0, 3);
    const additional = allProjects.filter((project) => !project.featured);

    featuredProjectsGrid.innerHTML = "";
    additionalProjectsGrid.innerHTML = "";

    if (featured.length === 0) {
      featuredProjectsGrid.innerHTML =
        '<p class="projects__empty">No featured projects found in <code>data/projects.json</code>.</p>';
    } else {
      featured.forEach((project) => {
        featuredProjectsGrid.appendChild(renderProjectCard(project));
      });
    }

    if (additional.length === 0) {
      if (additionalProjectsSection) {
        additionalProjectsSection.hidden = true;
      }
    } else {
      if (additionalProjectsSection) {
        additionalProjectsSection.hidden = false;
      }
      additional.forEach((project) => {
        additionalProjectsGrid.appendChild(renderProjectCard(project));
      });
    }
  } catch (error) {
    featuredProjectsGrid.innerHTML =
      '<p class="projects__empty">Unable to load projects right now. Check <code>data/projects.json</code>.</p>';
    if (additionalProjectsSection) {
      additionalProjectsSection.hidden = true;
    }
    console.error(error);
  }
};

const setupAwardsToggle = () => {
  if (!awardsMoreToggle || !awardsMorePanel) return;

  const collapsedLabel = awardsMoreToggle.dataset.collapsedLabel || "Show more awards";
  const expandedLabel = awardsMoreToggle.dataset.expandedLabel || "Show fewer awards";

  awardsMoreToggle.textContent = collapsedLabel;
  awardsMoreToggle.addEventListener("click", () => {
    const expanded = awardsMoreToggle.getAttribute("aria-expanded") === "true";
    awardsMoreToggle.setAttribute("aria-expanded", String(!expanded));
    awardsMorePanel.hidden = expanded;
    awardsMoreToggle.textContent = expanded ? collapsedLabel : expandedLabel;
  });
};

const setupBackToTop = () => {
  if (!backToTopButton) return;

  const toggleVisibility = () => {
    const shouldShow = window.scrollY > 520;
    backToTopButton.classList.toggle("is-visible", shouldShow);
  };

  backToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });

  window.addEventListener("scroll", toggleVisibility, { passive: true });
  toggleVisibility();
};

const setupReveal = () => {
  const revealElements = document.querySelectorAll(".reveal");
  if (!revealElements.length) return;

  if (!("IntersectionObserver" in window) || prefersReducedMotion) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
};

const setupActiveNav = () => {
  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  if (!navLinks.length) return;

  if (!("IntersectionObserver" in window)) {
    navLinks[0].classList.add("is-active");
    return;
  }

  const sectionMap = new Map();
  navLinks.forEach((link) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) sectionMap.set(target, link);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.classList.remove("is-active"));
        const activeLink = sectionMap.get(entry.target);
        if (activeLink) activeLink.classList.add("is-active");
      });
    },
    { threshold: 0.45 }
  );

  sectionMap.forEach((_, section) => observer.observe(section));
};

setupVideoModal();
setupReveal();
setupActiveNav();
setupAwardsToggle();
setupBackToTop();
renderProjects();
