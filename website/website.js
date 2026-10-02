// ==========================================
// FATHER'S JOY ACADEMY - PUBLIC WEBSITE JS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  
  // Theme management
  const body = document.body;
  const toggleTheme = () => {
    const isLight = body.classList.toggle("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  };

  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "light") {
    body.classList.add("light-theme");
  } else {
    body.classList.remove("light-theme");
  }

  const btnThemePublic = document.getElementById("btn-theme-toggle-public");
  if (btnThemePublic) btnThemePublic.addEventListener("click", toggleTheme);

  const btnThemeMobile = document.getElementById("btn-theme-toggle-mobile");
  if (btnThemeMobile) btnThemeMobile.addEventListener("click", toggleTheme);

  // Initialize Dynamic School Honeycomb Background
  const schoolGrid = document.getElementById("school-honeycomb-grid");
  if (schoolGrid && window.SchoolHoneycombEngine) {
    window.schoolHoneycomb = new SchoolHoneycombEngine(schoolGrid);
  }

  // Mobile Menu drawer
  const mobileMenu = document.getElementById("landing-mobile-menu");
  const menuToggleBtn = document.getElementById("btn-mobile-menu-toggle");
  const menuCloseBtn = document.getElementById("btn-mobile-menu-close");

  const openMobileMenu = (e) => {
    if (e) e.stopPropagation();
    mobileMenu.classList.remove("portal-hidden");
    requestAnimationFrame(() => {
      mobileMenu.classList.add("open");
    });
    body.style.overflow = "hidden";
  };

  const closeMobileMenu = () => {
    mobileMenu.classList.remove("open");
    setTimeout(() => {
      mobileMenu.classList.add("portal-hidden");
    }, 300);
    body.style.overflow = "";
  };

  if (menuToggleBtn) menuToggleBtn.addEventListener("click", openMobileMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener("click", closeMobileMenu);
  
  document.querySelectorAll(".mobile-menu-link").forEach(link => {
    link.addEventListener("click", closeMobileMenu);
  });

  // Clicking outside the menu panel to close
  if (mobileMenu) {
    mobileMenu.addEventListener("click", (e) => {
      const panel = mobileMenu.querySelector(".mobile-menu-panel");
      if (panel && !panel.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (mobileMenu && !mobileMenu.classList.contains("portal-hidden") && mobileMenu.classList.contains("open")) {
      const panel = mobileMenu.querySelector(".mobile-menu-panel");
      if (panel && !panel.contains(e.target) && menuToggleBtn && !menuToggleBtn.contains(e.target)) {
        closeMobileMenu();
      }
    }
  });

  // Portal Redirection
  const redirectToPortal = () => {
    window.location.href = "../portal/index.html";
  };
  
  document.getElementById("btn-portal-enter").addEventListener("click", redirectToPortal);
  document.getElementById("btn-portal-enter-mobile").addEventListener("click", redirectToPortal);

  // Load and Render CMS contents from Database
  async function renderWebsiteCMSAndCalendar() {
    try {
      const nameKey = await window.db.get("cms_content", "school_name");
    const titleKey = await window.db.get("cms_content", "hero_title");
    const subKey = await window.db.get("cms_content", "hero_subtitle");
    const missionKey = await window.db.get("cms_content", "mission_statement");
    const visionKey = await window.db.get("cms_content", "vision_statement");

    if (nameKey) document.getElementById("cms-nav-school-name").innerText = nameKey.value;
    if (titleKey) document.getElementById("cms-hero-title").innerText = titleKey.value;
    if (subKey) document.getElementById("cms-hero-subtitle").innerText = subKey.value;
    if (missionKey) document.getElementById("cms-mission-text").innerText = missionKey.value;
    if (visionKey) document.getElementById("cms-vision-text").innerText = visionKey.value;

    // Core Values
    const valuesKey = await window.db.get("cms_content", "core_values");
    if (valuesKey) {
      const values = JSON.parse(valuesKey.value);
      const container = document.getElementById("cms-values-container");
      container.innerHTML = values.map(val => `
        <div class="value-card">
          <h4 style="color:var(--accent-primary); margin-bottom:0.5rem;">${val.title}</h4>
          <p style="font-size:0.9rem; color:var(--text-secondary);">${val.desc}</p>
        </div>
      `).join("");
    }

    // Photo Gallery Grouping by Album
    const galleryKey = await window.db.get("cms_content", "gallery_images");
    if (galleryKey) {
      const gallery = JSON.parse(galleryKey.value);
      
      // Feed uploaded CMS gallery photos into the live honeycomb background
      if (Array.isArray(gallery) && gallery.length > 0 && window.schoolHoneycomb) {
        const cmsPhotoUrls = gallery.map(item => item.url).filter(Boolean);
        if (cmsPhotoUrls.length > 0) {
          window.schoolHoneycomb.setImages(cmsPhotoUrls);
        }
      }

      const albums = {};
      gallery.forEach(item => {
        const albumName = item.album || "General";
        if (!albums[albumName]) albums[albumName] = [];
        albums[albumName].push(item);
      });

      const container = document.getElementById("cms-gallery-container");
      if (container) {
        const albumKeys = Object.keys(albums).filter(name => albums[name] && albums[name].length > 0);
        if (albumKeys.length === 0) {
          container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.95rem;">
              Campus photo galleries will be available soon. Check back shortly!
            </div>
          `;
        } else {
          container.innerHTML = albumKeys.map(albumName => {
            const albumPhotos = albums[albumName];
            const firstPhoto = albumPhotos[0];
            return `
              <div class="gallery-item btn-open-album" data-album="${albumName}" style="cursor:pointer; position:relative;">
                <img src="${firstPhoto.url}" alt="${firstPhoto.title}">
                <div class="gallery-caption" style="text-align:center;">${albumName} (${albumPhotos.length} photos)</div>
              </div>
            `;
          }).join("");

          container.querySelectorAll(".btn-open-album").forEach(el => {
            el.addEventListener("click", () => {
              const albumName = el.getAttribute("data-album");
              const albumPhotos = albums[albumName];
              if (albumPhotos && albumPhotos.length > 0) {
                openGalleryCarousel(albumName, albumPhotos);
              }
            });
          });
        }
      }
    }

    // News Feed
    const newsKey = await window.db.get("cms_content", "news_feed");
    if (newsKey) {
      const news = JSON.parse(newsKey.value);
      const container = document.getElementById("cms-news-container");
      container.innerHTML = news.map(item => `
        <div class="news-card">
          <span class="news-meta">Published: ${item.date}</span>
          <h3 style="margin-bottom:0.5rem; font-family:var(--font-family-display);">${item.title}</h3>
          <p style="font-size:0.9rem; color:var(--text-secondary);">${item.summary}</p>
        </div>
      `).join("");
    }

    // Leadership Team
    const leadershipKey = await window.db.get("cms_content", "leadership_team");
    if (leadershipKey) {
      const team = JSON.parse(leadershipKey.value);
      const container = document.getElementById("cms-leadership-container");
      container.innerHTML = team.map(member => `
        <div class="value-card" style="text-align:center;">
          <div style="width:70px; height:70px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; color:white; font-size:1.5rem; font-weight:bold;">
            ${member.name.split(" ").pop().substring(0, 1)}
          </div>
          <h4 style="margin-bottom:0.25rem;">${member.name}</h4>
          <span style="font-size:0.8rem; color:var(--accent-secondary); font-weight:700;">${member.role}</span>
        </div>
      `).join("");
    }

    // Render Academic Calendar & Events on the website (Vertical & Center Aligned)
    const calendarKey = await window.db.get("academic_calendar", "main-calendar");
    const eventsContainer = document.getElementById("website-calendar-events-container");
    
    if (eventsContainer) {
      let events = (calendarKey && calendarKey.events && Array.isArray(calendarKey.events)) ? calendarKey.events : null;
      
      // Fallback if no events configured
      if (!events || events.length === 0) {
        const cal = calendarKey || {};
        events = [
          { name: "2025/2026 First Academic Term", start_date: cal.term1_start || "2026-01-05", end_date: cal.term1_end || "2026-04-15", time: "", notes: "" },
          { name: "2025/2026 Second Academic Term", start_date: cal.term2_start || "2026-05-04", end_date: cal.term2_end || "2026-07-31", time: "", notes: "" },
          { name: "2025/2026 Third Academic Term", start_date: cal.term3_start || "2026-08-03", end_date: cal.term3_end || "2026-12-15", time: "", notes: "" },
          { name: "PTA General Assembly & Parents Forum", start_date: cal.pta_date || "2026-09-19", end_date: cal.pta_date || "2026-09-19", time: "10:00", notes: "General assembly in the school auditorium." },
          { name: "Mid-Term Vacation Break", start_date: cal.midterm_start || "2026-10-12", end_date: cal.midterm_end || "2026-10-16", time: "", notes: "" },
          { name: "Term Promotional & Final Examinations Week", start_date: cal.exam_start || "2026-11-30", end_date: cal.exam_end || "2026-12-04", time: "", notes: "" }
        ];
      }

      // Auto-arrange for the earliest start date to lead the list
      events.sort((a, b) => {
        const dA = a.start_date || a.date || "";
        const dB = b.start_date || b.date || "";
        if (dA !== dB) return dA.localeCompare(dB);
        return (a.time || "").localeCompare(b.time || "");
      });

      const formatOrdinal = (dStr) => {
        if (!dStr) return "";
        const parts = dStr.split("-");
        if (parts.length !== 3) return dStr;
        const year = parts[0];
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
        const day = parseInt(parts[2], 10);
        let suffix = "th";
        if (day < 4 || day > 20) {
          if (day % 10 === 1) suffix = "st";
          else if (day % 10 === 2) suffix = "nd";
          else if (day % 10 === 3) suffix = "rd";
        }
        return `${day}${suffix} ${month} ${year}`;
      };

      const formatEventDates = (start, end) => {
        if (!start) return "Date to be announced";
        const startFmt = formatOrdinal(start);
        if (!end || end === start) return startFmt;
        const endFmt = formatOrdinal(end);
        return `${startFmt} – ${endFmt}`;
      };

      const formatTime12 = (tStr) => {
        if (!tStr) return "";
        if (/^\d{2}:\d{2}$/.test(tStr)) {
          const [h, m] = tStr.split(":").map(Number);
          const suffix = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          return `${h12}:${m < 10 ? '0' + m : m} ${suffix}`;
        }
        return tStr;
      };

      if (events.length === 0) {
        eventsContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:2rem 0;">No calendar events scheduled at this time.</p>`;
      } else {
        eventsContainer.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:1.25rem; max-width:850px; margin:0 auto;">
            ${events.map(ev => {
              const start = ev.start_date || ev.date || "";
              const end = ev.end_date || start;
              const dateStr = formatEventDates(start, end);
              const timeStr = formatTime12(ev.time);

              return `
                <div style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:12px; padding:1.5rem; display:flex; flex-direction:column; align-items:center; text-align:center; gap:0.45rem; transition:var(--transition-smooth); box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                  <!-- 1. Event Name First in Vertical Order (Center Aligned) -->
                  <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin:0; text-align:center;">
                    ${ev.name}
                  </h3>
                  
                  <!-- 2. Event Date Followed in Vertical Order without calendar icon (Center Aligned) -->
                  <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; flex-wrap:wrap; font-size:0.95rem; color:var(--accent-primary); font-weight:600; text-align:center;">
                    <span>${dateStr}</span>
                    ${timeStr ? `<span style="color:var(--text-secondary); font-weight:500; margin-left:0.5rem;">• ${timeStr}</span>` : ''}
                  </div>

                  <!-- 3. Event Notes (if present, Center Aligned) -->
                  ${ev.notes ? `
                    <p style="font-size:0.9rem; color:var(--text-secondary); margin:0.25rem auto 0 auto; line-height:1.5; text-align:center; max-width:650px;">
                      ${ev.notes}
                    </p>
                  ` : ''}
                </div>
              `;
            }).join("")}
          </div>
        `;
      }
    }

    } catch (err) {
      console.error("Website CMS render failed:", err);
    }
  }

  await renderWebsiteCMSAndCalendar();

  window.addEventListener("dbSyncUpdate", async (e) => {
    const { storeName } = (e && e.detail) || {};
    if (storeName === "cms_content" || storeName === "academic_calendar") {
      await renderWebsiteCMSAndCalendar();
    }
  });

  // Admissions Form Collapsible toggle
  const toggleBtn = document.getElementById("admissions-toggle");
  const formContainer = document.getElementById("admissions-form-container");
  const arrow = document.getElementById("admissions-arrow");

  if (toggleBtn && formContainer) {
    toggleBtn.addEventListener("click", () => {
      const isCollapsed = formContainer.classList.contains("portal-hidden");
      if (isCollapsed) {
        formContainer.classList.remove("portal-hidden");
        arrow.style.transform = "rotate(180deg)";
      } else {
        formContainer.classList.add("portal-hidden");
        arrow.style.transform = "rotate(0deg)";
      }
    });
  }

  // Public Admissions Form Submission Handler
  document.getElementById("form-public-admission").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById("adm-child-first-name").value.trim();
    const otherName = document.getElementById("adm-child-other-name").value.trim();
    const surname = document.getElementById("adm-child-surname").value.trim();
    const childGender = document.getElementById("adm-child-gender") ? document.getElementById("adm-child-gender").value : "Male";
    const childDob = document.getElementById("adm-child-dob").value;
    const targetClass = document.getElementById("adm-class").value;
    const primaryPhone = document.getElementById("adm-primary-phone").value.trim();
    const primaryAddress = document.getElementById("adm-primary-address").value.trim();
    
    const fatherName = document.getElementById("adm-father-name").value.trim();
    const fatherOcc = document.getElementById("adm-father-occupation").value.trim();
    const fatherPhone = document.getElementById("adm-father-phone").value.trim();

    const motherName = document.getElementById("adm-mother-name").value.trim();
    const motherOcc = document.getElementById("adm-mother-occupation").value.trim();
    const motherPhone = document.getElementById("adm-mother-phone").value.trim();

    const comments = document.getElementById("adm-comments").value;
    const childFullName = `${firstName} ${otherName ? otherName + ' ' : ''}${surname}`.trim();
    const primaryContactName = fatherName || motherName || `Parent of ${firstName}`;

    try {
      const student_id = "u-pending-" + Date.now();
      
      const newUser = {
        user_id: student_id,
        uid: "PEND-" + String(Math.floor(1000 + Math.random() * 9000)),
        role: "Student",
        first_name: firstName,
        other_name: otherName,
        last_name: surname,
        gender: childGender,
        email: null,
        phone: primaryPhone,
        password_hash: "temp1234",
        is_temporal_pwd: true,
        status: "PENDING",
        seeking_class: targetClass,
        date_of_birth: childDob,
        created_at: new Date().toISOString()
      };

      const newProfile = {
        profile_id: "p-pending-" + Date.now(),
        user_id: student_id,
        photo_url: "",
        seeking_class: targetClass,
        address: primaryAddress,
        father_name: fatherName,
        father_occupation: fatherOcc,
        father_phone: fatherPhone,
        mother_name: motherName,
        mother_occupation: motherOcc,
        mother_phone: motherPhone,
        father_details: JSON.stringify({ name: fatherName, occupation: fatherOcc, phone: fatherPhone }),
        mother_details: JSON.stringify({ name: motherName, occupation: motherOcc, phone: motherPhone }),
        guardian_name: primaryContactName,
        guardian_phone: primaryPhone,
        guardian_email: "",
        guardian_details: JSON.stringify({
          father: { name: fatherName, occupation: fatherOcc, phone: fatherPhone },
          mother: { name: motherName, occupation: motherOcc, phone: motherPhone },
          primary: { name: primaryContactName, phone: primaryPhone, address: primaryAddress }
        }),
        emergency_contact: JSON.stringify({
          primary: { name: fatherName || motherName || primaryContactName, phone: primaryPhone, relation: fatherName ? "Father" : (motherName ? "Mother" : "Guardian") },
          secondary: { name: motherName && fatherName ? motherName : "", phone: motherPhone, relation: "Mother" }
        }),
        base_salary: 0.00,
        allowances: 0.00,
        appointment_date: null,
        comments: comments
      };

      await window.db.put("users", newUser);
      await window.db.put("profiles", newProfile);

      // Write notifications for Proprietor, HeadTeacher & Admin
      const rolesToNotify = ["Proprietor", "HeadTeacher", "Admin"];
      for (const r of rolesToNotify) {
        const notifId = "notif-" + Math.random().toString(36).substring(2, 9);
        await window.db.put("notifications", {
          notification_id: notifId,
          role: r,
          target_user_id: "",
          title: "New Online Admission",
          message: `New online admissions request submitted for ${childFullName} (Seeking: ${targetClass}).`,
          target_view: "admissions-intake",
          status: "UNREAD",
          created_at: new Date().toISOString()
        });
      }

      showToast(`Admissions Application for ${childFullName} submitted successfully!`, "success");
      document.getElementById("form-public-admission").reset();

      // Trigger Mock SMS Simulation via SMS API if loaded
      if (window.api && typeof window.api.simulateSMS === "function") {
        window.api.simulateSMS(primaryPhone, `Hello ${primaryContactName}, we have received your admissions request for ${childFullName} (${targetClass}) at Father's Joy Academy. Status: Pending Review.`);
      }

    } catch (err) {
      console.error("Admissions submission error:", err);
      showToast("Error processing admissions intake.", "danger");
    }
  });
});

// Toast notification helper
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Gallery Carousel Modal
function openGalleryCarousel(albumName, photos) {
  const modal = document.getElementById("gallery-carousel-modal");
  const body = document.getElementById("gallery-carousel-body");
  const closeBtn = document.getElementById("btn-close-gallery-carousel");

  let currentIndex = 0;

  function updateCarousel() {
    const photo = photos[currentIndex];
    body.innerHTML = `
      <h3 style="margin-bottom:0.25rem; color:white; font-family:var(--font-family-display); font-size:1.5rem;">${albumName} Album</h3>
      <div style="position:relative; display:flex; align-items:center; justify-content:center; width:100%; min-height:280px; max-height:75vh; border-radius:12px; background:transparent;">
        <img src="${photo.url}" alt="${photo.title || 'Photo'}" style="max-width:100%; max-height:70vh; width:auto; height:auto; object-fit:contain; border-radius:10px; box-shadow:0 12px 36px rgba(0,0,0,0.35); background:transparent; display:block; margin:0 auto;">
        
        ${photos.length > 1 ? `
          <button id="btn-carousel-prev" class="btn btn-secondary" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); border-radius:50%; width:44px; height:44px; min-height:44px; padding:0; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.7); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); color:white; font-size:1.35rem; cursor:pointer; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,0.3);">❮</button>
          <button id="btn-carousel-next" class="btn btn-secondary" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); border-radius:50%; width:44px; height:44px; min-height:44px; padding:0; display:flex; align-items:center; justify-content:center; background:rgba(15,23,42,0.7); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); color:white; font-size:1.35rem; cursor:pointer; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,0.3);">❯</button>
        ` : ''}
      </div>
      <div style="text-align:center;">
        <div style="font-size:1rem; color:white; font-weight:600; margin-top:0.25rem;">${photo.title || albumName}</div>
        <div style="font-size:0.85rem; color:rgba(255,255,255,0.7); margin-top:0.2rem; font-weight:500;">Photo ${currentIndex + 1} of ${photos.length}</div>
      </div>
    `;

    if (photos.length > 1) {
      document.getElementById("btn-carousel-prev").onclick = (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + photos.length) % photos.length;
        updateCarousel();
      };
      document.getElementById("btn-carousel-next").onclick = (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % photos.length;
        updateCarousel();
      };
    }
  }

  updateCarousel();
  modal.classList.remove("portal-hidden");

  const closeModal = () => {
    modal.classList.add("portal-hidden");
  };
  
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
}
