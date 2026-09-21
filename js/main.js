/* Carlos Atalluz — portfolio behaviour
   Projects are rendered from data/projects.json as numbered case studies. */

const featuredProjectsGrid = document.getElementById("featured-projects-grid");
const additionalProjectsGrid = document.getElementById("additional-projects-grid");
const additionalProjectsSection = document.getElementById("additional-projects");
const featuredProjectsToggle = document.getElementById("featured-projects-toggle");
const experienceToggle = document.getElementById("awards-more-toggle");
const experiencePanel = document.getElementById("awards-more-panel");
const masthead = document.querySelector(".masthead");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.getElementById("site-navigation");
const currentYear = document.getElementById("current-year");

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

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/* Headings remain readable to assistive technology while their visible letters
   receive a short, staggered entrance. */
const splitHeadingForMotion = (heading) => {
  if (!heading || heading.dataset.motionSplit === "true") return;

  const label = heading.innerText.replace(/\s+/g, " ").trim();
  if (!label) return;

  heading.dataset.motionSplit = "true";
  heading.setAttribute("aria-label", label);

  const textNodes = [];
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  let index = 0;
  textNodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach((part) => {
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }

      const word = document.createElement("span");
      word.className = "motion-word";
      [...part].forEach((character) => {
        const letter = document.createElement("span");
        letter.className = "motion-char";
        letter.style.setProperty("--motion-delay", `${100 + index * 24}ms`);
        letter.setAttribute("aria-hidden", "true");
        letter.textContent = character;
        word.appendChild(letter);
        index += 1;
      });
      fragment.appendChild(word);
    });
    node.replaceWith(fragment);
  });
};

const setupHeadingMotion = () => {
  document
    .querySelectorAll(".hero h1, .section-head h2, .research__head h2, .experience-story h2, .certificates__title h2, .collaboration-callout h2, .showcase-card__title")
    .forEach(splitHeadingForMotion);
};

/* Project data accepts either the original string form or a richer video object. */
const getVideo = (video) => {
  if (typeof video === "string" && video.trim()) return { src: video.trim() };
  if (video && typeof video.src === "string" && video.src.trim()) return video;
  return null;
};

const getFocusableElements = (container) =>
  [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null
  );

/* ---------- Video modal ---------------------------------------- */

const closeVideoModal = () => {
  if (!videoModal || !videoModalPlayer) return;

  videoModalPlayer.pause();
  videoModalPlayer.removeAttribute("src");
  videoModalPlayer.removeAttribute("poster");
  videoModalPlayer.load();
  videoModal.classList.remove("is-open");
  videoModal.hidden = true;
  document.body.classList.remove("modal-open");

  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
};

const openVideoModal = (video = {}, title = "Project") => {
  if (!videoModal || !videoModalPlayer || !videoModalTitle || !video?.src) return;

  lastFocusedElement = document.activeElement;
  videoModalTitle.textContent = `${title} demo video`;
  videoModalPlayer.setAttribute("aria-label", `${title} demo video`);
  videoModalPlayer.src = buildPath(video.src);
  if (video.poster) {
    videoModalPlayer.poster = buildPath(video.poster);
  } else {
    videoModalPlayer.removeAttribute("poster");
  }
  videoModalPlayer.load();

  const caption = video.description?.trim() || "";
  if (videoModalCaption) {
    videoModalCaption.textContent = caption;
    videoModalCaption.hidden = !caption;
  }

  videoModal.hidden = false;
  videoModal.classList.add("is-open");
  document.body.classList.add("modal-open");
  getFocusableElements(videoModal)[0]?.focus();
  videoModalPlayer.play().catch(() => {});
};

const handleModalKeydown = (event) => {
  if (!videoModal || videoModal.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeVideoModal();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = getFocusableElements(videoModal);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
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
  videoModal.querySelectorAll("[data-video-close]").forEach((control) => {
    control.addEventListener("click", closeVideoModal);
  });
  document.addEventListener("keydown", handleModalKeydown);
};

/* ---------- Case study pieces ----------------------------------- */

const buildMedia = (project) => {
  const figure = createElement("figure", "case__media");
  const videoData = getVideo(project.video);

  if (videoData) {
    /* The card gives a silent preview; the accessible control opens the full demo. */
    const video = document.createElement("video");
    video.src = buildPath(videoData.src);
    if (videoData.poster) video.poster = buildPath(videoData.poster);
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "metadata");
    video.setAttribute("aria-hidden", "true");
    figure.style.setProperty("--media-ar", "1.778");
    figure.appendChild(video);

    const watchButton = createElement("button", "case__watch-video", "Watch demo");
    watchButton.type = "button";
    watchButton.setAttribute("aria-label", `Watch the ${project.title} demo video`);
    watchButton.addEventListener("click", () => openVideoModal(videoData, project.title));
    figure.appendChild(watchButton);
  } else {
    const image = document.createElement("img");
    image.src = buildPath(project.thumbnail || FALLBACK_THUMBNAIL);
    image.alt = `${project.title} interface preview`;
    image.width = 1280;
    image.height = 720;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      const fallback = buildPath(FALLBACK_THUMBNAIL);
      if (image.src !== fallback) image.src = fallback;
    });

    /* Each plate takes the screenshot's own proportions, so nothing is cropped. */
    const applyRatio = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      figure.style.setProperty("--media-ar", String(Math.min(Math.max(ratio, 1.15), 2.2)));
    };
    image.addEventListener("load", applyRatio);
    if (image.complete) applyRatio();

    figure.appendChild(image);
  }

  return figure;
};

const buildNote = (label, value, note) => {
  const paragraph = createElement("p", "note");
  paragraph.append(createElement("span", "note__label", label), document.createTextNode(value));
  if (note) paragraph.appendChild(createElement("span", "note__note", ` (${note})`));
  return paragraph;
};

const buildNotes = (project) => {
  const notes = createElement("div", "case__notes");
  if (project.problem) notes.appendChild(buildNote("Problem", project.problem));
  if (project.built) notes.appendChild(buildNote("What I built", project.built));

  const result = project.status === "placeholder" ? "Early prototype; results pending." : project.result;
  if (result) notes.appendChild(buildNote("Result", result, project.metrics_note));
  return notes;
};

const buildRoadmap = (project) => {
  if (!Array.isArray(project.roadmap) || !project.roadmap.length) return null;
  const wrapper = createElement("div", "case__roadmap");
  wrapper.appendChild(createElement("h4", "label", "In development"));
  const list = document.createElement("ul");
  project.roadmap.forEach((item) => list.appendChild(createElement("li", "", item)));
  wrapper.appendChild(list);
  return wrapper;
};

/* Stacks read as one quiet line of type, not as pills. */
const buildStack = (stack = []) => {
  if (!Array.isArray(stack) || !stack.length) return null;
  const paragraph = createElement("p", "case__stack");
  stack.forEach((item, index) => {
    if (index) {
      /* Non-breaking space before the separator, normal space after: the line can
         wrap between items but never opens with a stray middot. */
      const separator = createElement("span", "sep", "\u00A0\u00B7 ");
      separator.setAttribute("aria-hidden", "true");
      paragraph.appendChild(separator);
    }
    paragraph.appendChild(document.createTextNode(item));
  });
  return paragraph;
};

const buildLinks = (project) => {
  const labels = [
    ["visit", "Visit"],
    ["demo", "Live demo"],
    ["github", "GitHub"],
    ["writeup", "Case study"]
  ];
  const links = project.links || {};
  const wrapper = createElement("p", "case__links");

  const video = getVideo(project.video);
  const videoButton = video ? createElement("button", "case__video", "Video") : null;
  if (videoButton) {
    videoButton.type = "button";
    videoButton.setAttribute("aria-label", `Open demo video for ${project.title}`);
    videoButton.addEventListener("click", () => openVideoModal(video, project.title));
    wrapper.appendChild(videoButton);
  }

  labels.forEach(([key, label]) => {
    const value = typeof links[key] === "string" ? links[key].trim() : "";
    if (!value || value === "#") return;

    const link = createElement("a", key === "visit" ? "case__visit" : "", label);
    link.href = buildPath(value);
    if (key !== "visit") {
      const arrow = createElement("span", "arrow", "\u2197");
      arrow.setAttribute("aria-hidden", "true");
      link.appendChild(arrow);
    }

    if (/^(https?:)?\/\//.test(value)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${label} for ${project.title} (opens in a new tab)`);
    } else {
      link.setAttribute("aria-label", `${label} for ${project.title}`);
    }
    wrapper.appendChild(link);
  });

  return wrapper.childElementCount ? wrapper : null;
};

const buildMetaRow = (number, phase) => {
  const meta = createElement("div", "case__meta");
  meta.appendChild(createElement("p", "case__num", number));
  if (phase) meta.appendChild(createElement("p", "case__phase", phase));
  return meta;
};

/* The staged system behind the flagship, read as an ordered list of hairline rows. */
const buildPipeline = (project) => {
  if (!Array.isArray(project.pipeline) || !project.pipeline.length) return null;

  const wrapper = createElement("div", "case__pipeline");
  wrapper.appendChild(createElement("h4", "label", `Review pipeline — ${project.pipeline.length} stages`));

  const list = createElement("ol", "pipeline");
  project.pipeline.forEach((step, index) => {
    if (!step?.stage) return;
    const item = document.createElement("li");
    item.appendChild(createElement("span", "pipeline__index", String(index + 1)));
    const body = createElement("div", "pipeline__body");
    body.appendChild(createElement("p", "pipeline__stage", step.stage));
    if (step.detail) body.appendChild(createElement("p", "pipeline__detail", step.detail));
    item.appendChild(body);
    list.appendChild(item);
  });

  /* A bracket holds the numbered stages; the cross-cutting concern hangs off it. */
  const span = createElement("div", "pipeline__span");
  span.appendChild(list);
  wrapper.appendChild(span);

  const cross = project.crosscutting;
  if (cross?.stage) {
    const aside = createElement("div", "pipeline__crosscut");
    aside.appendChild(createElement("p", "label pipeline__crosscut-label", cross.label || "Across every stage"));
    aside.appendChild(createElement("p", "pipeline__stage", cross.stage));
    if (cross.detail) aside.appendChild(createElement("p", "pipeline__detail", cross.detail));
    wrapper.appendChild(aside);
  }

  return list.childElementCount ? wrapper : null;
};

/* The flagship: number and title on top, image full width, system and story below. */
const renderLeadCase = (project, number) => {
  const article = createElement("article", "case case--lead");

  const head = createElement("div", "case__head");
  const identity = createElement("div", "case__identity");
  const num = createElement("p", "case__num", number);
  num.appendChild(createElement("span", "case__flag", "Flagship"));
  identity.appendChild(num);
  identity.appendChild(createElement("h3", "case__title", project.title));
  if (project.tagline) identity.appendChild(createElement("p", "case__tagline", project.tagline));
  head.appendChild(identity);
  if (project.phase) head.appendChild(createElement("p", "case__phase", project.phase));

  const side = createElement("div", "case__side");
  const roadmap = buildRoadmap(project);
  const stack = buildStack(project.stack);
  const links = buildLinks(project);
  if (roadmap) side.appendChild(roadmap);
  if (stack) side.appendChild(stack);
  if (links) side.appendChild(links);

  article.append(head, buildMedia(project), buildNotes(project));

  const pipeline = buildPipeline(project);
  if (pipeline) {
    article.appendChild(pipeline);
    article.classList.add("has-pipeline");
  }
  if (side.childElementCount) article.appendChild(side);
  return article;
};

/* Everything else: image on one side, the whole story on the other. */
const renderSplitCase = (project, number, { brief = false, flipped = false } = {}) => {
  const article = createElement("article", `case case--${brief ? "brief" : "split"}`);
  if (flipped) article.classList.add("is-flipped");
  if (project.status === "placeholder") article.classList.add("is-placeholder");

  const body = createElement("div", "case__body");
  const head = createElement("div", "case__head");
  head.appendChild(buildMetaRow(number, project.phase));
  head.appendChild(createElement("h3", "case__title", project.title));
  if (project.tagline) head.appendChild(createElement("p", "case__tagline", project.tagline));

  body.append(head, buildNotes(project));

  const roadmap = buildRoadmap(project);
  const stack = buildStack(project.stack);
  const links = buildLinks(project);
  if (roadmap) body.appendChild(roadmap);
  if (stack) body.appendChild(stack);
  if (links) body.appendChild(links);

  article.append(buildMedia(project), body);
  return article;
};

/* Compact project card: the details stay available without making the work feed read like a report. */
const renderCompactProject = (project, number, index) => {
  const article = createElement("article", "project-card");
  article.dataset.tone = String((index % 5) + 1);

  const body = createElement("div", "project-card__body");
  const meta = buildMetaRow(number, project.phase);
  body.appendChild(meta);
  body.appendChild(createElement("h3", "project-card__title", project.title));
  if (project.tagline) body.appendChild(createElement("p", "project-card__summary", project.tagline));

  const stack = buildStack(project.stack);
  if (stack) body.appendChild(stack);
  const links = buildLinks(project);
  if (links) body.appendChild(links);

  if (project.problem || project.built || project.result) {
    const details = createElement("details", "project-card__details");
    details.appendChild(createElement("summary", "", "Project notes"));
    details.appendChild(buildNotes(project));
    body.appendChild(details);
  }

  article.append(buildMedia(project), body);
  return article;
};

/* Work overview: every project is a compact, equal-weight card. */
const renderShowcaseCard = (project, number, index) => {
  const article = createElement("article", "showcase-card");
  article.dataset.project = String(index + 1);
  if (index >= 3) article.classList.add("showcase-card--extra");

  const body = createElement("div", "showcase-card__body");
  body.appendChild(buildMetaRow(number, project.phase));
  body.appendChild(createElement("h3", "showcase-card__title", project.title));
  if (project.tagline) body.appendChild(createElement("p", "showcase-card__summary", project.tagline));
  const links = buildLinks(project);
  if (links) body.appendChild(links);

  article.appendChild(body);
  return article;
};

const renderProjects = async () => {
  if (!featuredProjectsGrid || !additionalProjectsGrid) return;

  try {
    const response = await fetch(new URL("../data/projects.json", import.meta.url));
    if (!response.ok) throw new Error(`Could not load projects: ${response.status}`);

    const data = await response.json();
    const projects = Array.isArray(data.projects)
      ? data.projects.filter((project) => project.display !== false)
      : [];
    /* Keep every visible project in the showcase; the disclosure controls
       visibility after the first three without dropping later work. */
    const selected = projects;

    featuredProjectsGrid.replaceChildren();
    additionalProjectsGrid.replaceChildren();

    const numberOf = (index) => String(index + 1).padStart(2, "0");

    const showcase = createElement("div", "project-showcase");
    showcase.id = "featured-project-showcase";
    selected.forEach((project, index) => {
      showcase.appendChild(renderShowcaseCard(project, numberOf(index), index));
    });
    if (showcase.childElementCount) featuredProjectsGrid.appendChild(showcase);

    const extraCards = showcase.querySelectorAll(".showcase-card--extra");
    extraCards.forEach((card) => { card.hidden = true; });
    if (featuredProjectsToggle) {
      featuredProjectsToggle.hidden = extraCards.length === 0;
      featuredProjectsToggle.setAttribute("aria-expanded", "false");
      featuredProjectsToggle.querySelector(".projects-disclosure__text").textContent = "See more";
      featuredProjectsToggle.querySelector(".projects-disclosure__chevron").textContent = "⌄";
    }

    if (!selected.length) {
      featuredProjectsGrid.appendChild(
        createElement("p", "cases__empty", "No featured projects are available right now.")
      );
    }
    if (additionalProjectsSection) additionalProjectsSection.hidden = true;
  } catch (error) {
    featuredProjectsGrid.replaceChildren(
      createElement("p", "cases__empty", "Unable to load projects right now.")
    );
    if (additionalProjectsSection) additionalProjectsSection.hidden = true;
    console.error(error);
  }
};

const setupFeaturedProjectsToggle = () => {
  if (!featuredProjectsToggle || featuredProjectsToggle.dataset.bound) return;
  featuredProjectsToggle.dataset.bound = "true";

  featuredProjectsToggle.addEventListener("click", () => {
    const showcase = featuredProjectsGrid?.querySelector(".project-showcase");
    if (!showcase) return;

    const shouldExpand = featuredProjectsToggle.getAttribute("aria-expanded") !== "true";
    showcase.querySelectorAll(".showcase-card--extra").forEach((card) => {
      card.hidden = !shouldExpand;
    });
    showcase.classList.toggle("is-expanded", shouldExpand);
    featuredProjectsToggle.setAttribute("aria-expanded", String(shouldExpand));
    featuredProjectsToggle.querySelector(".projects-disclosure__text").textContent = shouldExpand ? "Show less" : "See more";
    featuredProjectsToggle.querySelector(".projects-disclosure__chevron").textContent = shouldExpand ? "⌃" : "⌄";
  });
};

/* ---------- Interface behaviour --------------------------------- */

const setupExperienceToggle = () => {
  if (!experienceToggle || !experiencePanel) return;
  const text = experienceToggle.querySelector(".disclosure__text") || experienceToggle;
  const collapsed = experienceToggle.dataset.collapsedLabel || "More experience details";
  const expanded = experienceToggle.dataset.expandedLabel || "Fewer experience details";

  experienceToggle.addEventListener("click", () => {
    const isOpen = experienceToggle.getAttribute("aria-expanded") === "true";
    experienceToggle.setAttribute("aria-expanded", String(!isOpen));
    experiencePanel.hidden = isOpen;
    text.textContent = isOpen ? collapsed : expanded;
  });
};

const closeNavigation = () => {
  if (!navToggle || !siteNav) return;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
  siteNav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
};

const setupNavigation = () => {
  if (!navToggle || !siteNav) return;

  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    siteNav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  });

  siteNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNavigation));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && siteNav.classList.contains("is-open")) closeNavigation();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeNavigation();
  });
};

/* A hairline appears under the masthead only once the page has moved, and solid background engages once past the video hero. */
const setupMasthead = () => {
  if (!masthead) return;
  const cinematicHero = document.getElementById("cinematic-hero");

  const update = () => {
    const heroHeight = cinematicHero ? cinematicHero.offsetHeight : 0;
    const isSolid = window.scrollY >= (heroHeight - 64);
    masthead.classList.toggle("is-solid", isSolid);
    masthead.classList.toggle("is-stuck", window.scrollY > 8);
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
};

const setupHeroVideo = () => {
  const video = document.getElementById("hero-video-element");
  const toggleBtn = document.getElementById("hero-video-toggle");
  if (!video || !toggleBtn) return;

  const playIcon = toggleBtn.querySelector(".hero-video__icon--play");
  const pauseIcon = toggleBtn.querySelector(".hero-video__icon--pause");
  const btnText = toggleBtn.querySelector(".hero-video__btn-text");
  let userInteracted = false;

  const loadVideo = () => {
    const source = video.dataset.src;
    if (!source) return;
    video.src = source;
    delete video.dataset.src;
    video.load();
  };

  const setPlayingState = (isPlaying) => {
    toggleBtn.setAttribute("data-state", isPlaying ? "playing" : "paused");
    toggleBtn.setAttribute("aria-label", isPlaying ? "Pause background video" : "Play background video");
    if (playIcon) playIcon.hidden = isPlaying;
    if (pauseIcon) pauseIcon.hidden = !isPlaying;
    if (btnText) btnText.textContent = isPlaying ? "Pause" : "Play";
  };

  toggleBtn.addEventListener("click", () => {
    userInteracted = true;
    if (video.paused) {
      loadVideo();
      video.play().then(() => setPlayingState(true)).catch(() => {});
    } else {
      video.pause();
      setPlayingState(false);
    }
  });

  video.addEventListener("play", () => setPlayingState(true));
  video.addEventListener("pause", () => setPlayingState(false));

  if (prefersReducedMotion) {
    video.pause();
    setPlayingState(false);
  } else {
    const startVideo = () => {
      if (userInteracted || document.hidden || !video.paused) return;
      loadVideo();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setPlayingState(true))
          .catch(() => setPlayingState(false));
      }
    };

    /* Let the poster paint and controls respond before decoding the background
       video. A slow offscreen image should never delay its eventual start. */
    const scheduleVideo = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(startVideo, { timeout: 1200 });
      } else {
        startVideo();
      }
    };

    setPlayingState(false);
    window.setTimeout(() => {
      if (document.hidden) {
        document.addEventListener("visibilitychange", scheduleVideo, { once: true });
      } else {
        scheduleVideo();
      }
    }, 1200);
  }
};

const setupReveal = () => {
  const elements = document.querySelectorAll(".reveal");
  if (!elements.length) return;

  if (!("IntersectionObserver" in window) || prefersReducedMotion) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll(".showcase-card, .research-card").forEach((card) => {
          const settleCard = (event) => {
            if (event.target !== card || event.animationName !== "motion-pop") return;
            card.classList.add("motion-complete");
            card.removeEventListener("animationend", settleCard);
          };
          card.addEventListener("animationend", settleCard);
        });
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.04, rootMargin: "0px 0px -6%" }
  );
  elements.forEach((element) => observer.observe(element));
};

const setupActiveNav = () => {
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const pairs = links
    .map((link) => [link, document.querySelector(link.getAttribute("href"))])
    .filter(([, section]) => section);
  if (!pairs.length) return;

  let scheduled = false;
  const update = () => {
    const marker = window.innerHeight * 0.34;
    let activeLink = null;
    pairs.forEach(([link, section]) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker && rect.bottom > marker) activeLink = link;
    });

    links.forEach((link) => {
      const active = link === activeLink;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    scheduled = false;
  };

  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();
};

/* Decorative only: the sparkle field adds atmosphere without adding content
   or changing the accessible reading order. */
const setupSparkleFields = () => {
  const animatedSections = [];
  const fields = [
    [".hero", [
      ["10%", "8%", "3.5rem", "#55aaff", "-1s", "7.2s"],
      ["30%", "12%", "1.35rem", "#b879ff", "-4.8s", "8.6s"],
      ["56%", "43%", "2.1rem", "#61e9ff", "-2.2s", "6.8s"],
      ["70%", "5%", "1.15rem", "#55aaff", "-6.1s", "9.4s"],
      ["78%", "27%", "2.7rem", "#f15cff", "-3.4s", "10.2s"],
      ["22%", "53%", "1.65rem", "#61e9ff", "-7.2s", "7.8s"],
      ["44%", "4%", "1rem", "#f15cff", "-5.7s", "11.3s"],
      ["88%", "58%", "1.5rem", "#55aaff", "-2.9s", "8.9s"]
    ]],
    ["#featured-projects", [
      ["8%", "18%", "1.25rem", "#ff5a6f", "-2.5s", "7.4s"],
      ["18%", "46%", "2.4rem", "#55aaff", "-5.2s", "9.1s"],
      ["36%", "7%", "1.55rem", "#d16cff", "-1.3s", "6.6s"],
      ["48%", "68%", "1.15rem", "#ff5a6f", "-6.7s", "8.8s"],
      ["72%", "32%", "2.8rem", "#55aaff", "-3.9s", "10.4s"],
      ["86%", "89%", "1.35rem", "#d16cff", "-8.1s", "7.1s"],
      ["61%", "93%", "1.05rem", "#ff5a6f", "-4.4s", "9.8s"],
      ["29%", "84%", "1.8rem", "#55e6ff", "-7.8s", "11.6s"],
      ["93%", "53%", "1.1rem", "#ff5a6f", "-1.9s", "8.1s"],
      ["42%", "25%", "1.35rem", "#d16cff", "-5.5s", "7.3s"]
    ]],
    ["#research", [
      ["9%", "13%", "1.4rem", "#ff5a6f", "-5.4s", "8.2s"],
      ["17%", "58%", "2.55rem", "#55aaff", "-1.7s", "10.1s"],
      ["32%", "3%", "1.1rem", "#a778ff", "-7.2s", "6.9s"],
      ["54%", "74%", "1.55rem", "#ff5a6f", "-3.3s", "8.7s"],
      ["71%", "21%", "2.2rem", "#55aaff", "-6.6s", "9.6s"],
      ["86%", "94%", "1.2rem", "#a778ff", "-2.1s", "7.5s"],
      ["63%", "51%", "1rem", "#ff5a6f", "-8.4s", "11.2s"],
      ["44%", "28%", "1.65rem", "#55e6ff", "-4.1s", "9.9s"],
      ["78%", "7%", "1.05rem", "#ff5a6f", "-6.8s", "6.4s"],
      ["91%", "71%", "1.45rem", "#a778ff", "-1.6s", "10.8s"]
    ]],
    [".organizations", [
      ["12%", "9%", "1.2rem", "#55aaff", "-6.4s", "7.8s"],
      ["27%", "35%", "2.5rem", "#ff5a6f", "-2.7s", "10.5s"],
      ["18%", "79%", "1.4rem", "#d16cff", "-4.9s", "8.4s"],
      ["52%", "17%", "1.05rem", "#55aaff", "-1.1s", "6.7s"],
      ["67%", "62%", "2.15rem", "#ff5a6f", "-7.5s", "9.2s"],
      ["82%", "87%", "1.35rem", "#d16cff", "-3.8s", "11s"],
      ["39%", "48%", "1.65rem", "#55e6ff", "-5.9s", "7.6s"],
      ["74%", "29%", "1rem", "#ff5a6f", "-1.4s", "9.7s"],
      ["89%", "72%", "2rem", "#55aaff", "-7.1s", "12.2s"]
    ]]
  ];

  fields.forEach(([selector, sparks]) => {
    const section = document.querySelector(selector);
    if (!section || section.querySelector(":scope > .sparkle-field")) return;

    const field = createElement("div", "sparkle-field");
    field.setAttribute("aria-hidden", "true");
    sparks.forEach(([top, left, size, color, delay, duration]) => {
      const spark = createElement("span", "sparkle-field__star");
      spark.style.setProperty("--sparkle-top", top);
      spark.style.setProperty("--sparkle-left", left);
      spark.style.setProperty("--sparkle-size", size);
      spark.style.setProperty("--sparkle-color", color);
      spark.style.setProperty("--sparkle-delay", delay);
      spark.style.setProperty("--sparkle-duration", duration);
      field.appendChild(spark);
    });
    section.prepend(field);
    animatedSections.push([section, field]);
  });

  if (!animatedSections.length) return;

  const setActive = (section, field, active) => {
    field.classList.toggle("is-active", active);
    if (section.classList.contains("organizations")) {
      section.classList.toggle("is-animation-active", active);
    }
  };

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    animatedSections.forEach(([section, field]) => setActive(section, field, true));
    return;
  }

  const animationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const field = entry.target.querySelector(":scope > .sparkle-field");
        if (field) setActive(entry.target, field, entry.isIntersecting);
      });
    },
    { threshold: 0.01, rootMargin: "18% 0px" }
  );

  animatedSections.forEach(([section]) => animationObserver.observe(section));
};

const init = () => {
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());
  setupHeroVideo();
  setupVideoModal();
  setupNavigation();
  setupMasthead();
  setupExperienceToggle();
  setupFeaturedProjectsToggle();
  setupHeadingMotion();
  setupReveal();
  setupSparkleFields();
  setupActiveNav();
  /* The hero and navigation must be ready even if project data is slow. */
  void renderProjects();
};

init();
