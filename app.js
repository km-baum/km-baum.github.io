/**
 * Krügermeyer – Interaktive Stammbaum- & Chronik-Engine (Museum-Grade Edition)
 */

(function () {
  const DATA = window.KRUEGERMEYER_DATA;
  if (!DATA) return;

  // LocalStorage keys for user-customizable photos and additional articles/notes
  const PHOTO_STORAGE_KEY = "kruegermeyer_custom_photos_v1";
  const ARTICLE_STORAGE_KEY = "kruegermeyer_custom_articles_v1";

  let customPhotos = {};
  let customArticles = {};

  try {
    customPhotos = JSON.parse(localStorage.getItem(PHOTO_STORAGE_KEY) || "{}");
    customArticles = JSON.parse(localStorage.getItem(ARTICLE_STORAGE_KEY) || "{}");
  } catch (e) {
    console.warn("LocalStorage nicht verfügbar:", e);
  }

  // Default to the user's direct 7-generation family line ("bremen")
  let activeView = "tree"; // 'tree' | 'chronicle' | 'people' | 'photos' | 'archive' | 'places'
  let activeBranchFilter = "bremen";
  let searchQuery = "";
  let selectedPersonId = null;

  // Pan & Zoom state for Tree
  let panX = 30;
  let panY = 20;
  let scale = 0.78;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // Lookup Maps
  const peopleById = new Map();
  DATA.people.forEach((p) => peopleById.set(p.id, p));

  const branchesById = new Map();
  DATA.branches.forEach((b) => branchesById.set(b.id, b));

  // Direct Bloodline & Immediate Family IDs (highlighted with Gold Frame & Kinship Badge)
  const DIRECT_ANCESTOR_ROLES = {
    "johann-christoph-kruegermeyer-1775": { label: "4x-Urgroßvater", direct: true },
    "anna-maria-elisabeth-priester-1778": { label: "4x-Urgroßmutter", direct: true },
    "johann-christoph-diekmann-1795": { label: "4x-Urgroßvater", direct: true },
    "amalie-sophie-luise-hessloh-1800": { label: "4x-Urgroßmutter", direct: true },
    "johann-friedrich-christoph-meyne-1789": { label: "4x-Urgroßvater", direct: true },
    "maria-margreta-mueller-1789": { label: "4x-Urgroßmutter", direct: true },

    "heinrich-kruegermeyer-1825": { label: "3x-Urgroßvater", direct: true },
    "amalie-florentine-henriette-diekmann-1829": { label: "3x-Urgroßmutter", direct: true },
    "philipp-heinrich-meyne-1823": { label: "3x-Urgroßvater", direct: true },
    "meta-margarethe-eschenbach-1835": { label: "3x-Urgroßmutter", direct: true },

    "ernst-kruegermeyer-1859": { label: "Ururgroßvater", direct: true },
    "meta-margarethe-meyne-1866": { label: "Ururgroßmutter", direct: true },
    "heinrich-kruegermeyer-jun-1863": { label: "Ururgroßonkel", direct: false },
    "august-kuhlmann-1860": { label: "Ururgroßonkel", direct: false },

    "herbert-gustav-kruegermeyer-1907": { label: "Urgroßvater", direct: true },
    "christel-kruegermeyer-bremen": { label: "Urgroßmutter", direct: true },
    "ernst-otto-kruegermeyer-1907": { label: "Urgroßonkel (Zwilling)", direct: false },
    "charlotte-weber-1910": { label: "Urgroßtante", direct: false },
    "johannes-heinrich-wilhelm-kruegermeyer-1891": { label: "Urgroßonkel", direct: false },
    "meta-margarethe-amalie-kruegermeyer-1890": { label: "Urgroßtante", direct: false },

    "gerd-kruegermeyer-1940": { label: "Großvater (Opa)", direct: true },
    "vera-theresia-kruegermeyer-1942": { label: "Großmutter (Oma)", direct: true },
    "lutz-kruegermeyer-1942": { label: "Großonkel", direct: false },
    "jens-peter-kruegermeyer-1944": { label: "Großonkel († 1945)", direct: false },
    "helmut-kruegermeyer-1938": { label: "Cousin v. Opa Gerd", direct: false },
    "haide-kruegermeyer-1939": { label: "Cousine v. Opa Gerd", direct: false },

    "aike-kristian-kruegermeyer-1970": { label: "Vater (* Hannover)", direct: true },
    "claudia-kruegermeyer-hentschel": { label: "Mutter (geb. Hentschel)", direct: true },
    "lidia-kruegermeyer": { label: "Stiefmutter (* Warschau)", direct: true },
    "lars-kruegermeyer-1972": { label: "Onkel (* Köln)", direct: true },
    "jasmin-kruegermeyer": { label: "Tante", direct: true },
    "carsten-kruegermeyer-1965": { label: "Cousin 2. Grades", direct: false },
    "moena-hecker-1966": { label: "Cousine 2. Grades", direct: false },
    "vanessa-hecker-1971": { label: "Cousine 2. Grades", direct: false },

    "noah-elias-kruegermeyer": { label: "★ 7. Gen. · Chronist", direct: true },
    "leon-bennet-kruegermeyer": { label: "★ Bruder (7. Gen.)", direct: true },
    "luca-kruegermeyer": { label: "★ Cousin (7. Gen.)", direct: true },
    "lino-valentino-kruegermeyer": { label: "★ Cousin (7. Gen.)", direct: true }
  };

  const LINEAGE_STEPS = [
    {
      gen: 1,
      period: "1. Gen. · um 1775–1801",
      names: "Johann Christoph Krügermeyer & Anna Maria Priester",
      place: "St. Nicolai Lemgo, Heiden & Bremen",
      focusId: "johann-christoph-kruegermeyer-1775"
    },
    {
      gen: 2,
      period: "2. Gen. · 1813–1917",
      names: "Henrich Christoph Krügermeyer & Amalia Diekmann",
      place: "Lemgo (Rampendahlstr. 43) & Heiden",
      focusId: "heinrich-kruegermeyer-1825"
    },
    {
      gen: 3,
      period: "3. Gen. · 1859–1955",
      names: "Ernst Simon Krügermeyer & Meta Margarethe Meyne",
      place: "Lemgo → Bremen (Herderstr. 57)",
      focusId: "ernst-kruegermeyer-1859"
    },
    {
      gen: 4,
      period: "4. Gen. · 1907–1998",
      names: "Herbert Gustav Krügermeyer & Christel Krügermeyer",
      place: "Bremen & Berlin-Prenzlauer Berg",
      focusId: "herbert-gustav-kruegermeyer-1907"
    },
    {
      gen: 5,
      period: "5. Gen. · Großeltern",
      names: "Gerd Krügermeyer & Vera-Theresia Krügermeyer",
      place: "Bremen & Hambergen bei Bremen",
      focusId: "gerd-kruegermeyer-1940"
    },
    {
      gen: 6,
      period: "6. Gen. · Eltern, Stiefmutter & Onkel",
      names: "Aike-Kristian & Lidia / Claudia · Lars & Jasmin",
      place: "Hannover, Warschau, Köln & Bremen",
      focusId: "aike-kristian-kruegermeyer-1970"
    },
    {
      gen: 7,
      period: "7. Gen. · Gegenwart",
      names: "Noah-Elias, Leon-Bennet, Luca & Lino Valentino",
      place: "Alle geboren in Bremen",
      focusId: "noah-elias-kruegermeyer"
    }
  ];

  // Helper: Get person's effective photo
  function getPersonPhoto(personId) {
    const p = peopleById.get(personId);
    if (customPhotos[personId]) return customPhotos[personId];
    return p && p.photo ? p.photo : null;
  }

  // Helper: Get person's initials
  function getInitials(person) {
    const f = (person.firstName || "").trim().charAt(0);
    const l = (person.lastName || "").trim().charAt(0);
    return (f + l).toUpperCase() || "KM";
  }

  // Helper: Format lifespan string
  function formatLifespan(person) {
    const b = person.birthDate
      ? `* ${person.birthDate}`
      : person.birthPlace
      ? `* in ${person.birthPlace}`
      : "";
    const d = person.deathDate ? `† ${person.deathDate}` : "";
    if (b && d) return `${b}  ·  ${d}`;
    return b || d || "Zeitraum dokumentiert";
  }

  // Helper: Get all relatives of a person (including grandparents, uncles/aunts, cousins, nephews/nieces, grandchildren)
  function getRelatives(personId) {
    const parents = [];
    const spouses = [];
    const children = [];
    const siblings = new Set();
    const grandparents = new Set();
    const grandchildren = new Set();
    const unclesAunts = new Set();
    const cousins = new Set();
    const nephewsNieces = new Set();

    DATA.relationships.forEach((rel) => {
      if (rel.type === "marriage") {
        if (rel.partner1 === personId) {
          spouses.push({
            person: peopleById.get(rel.partner2),
            date: rel.date,
            place: rel.place,
            roleLabel: rel.roleLabel
          });
        } else if (rel.partner2 === personId) {
          spouses.push({
            person: peopleById.get(rel.partner1),
            date: rel.date,
            place: rel.place,
            roleLabel: rel.roleLabel
          });
        }
      } else if (rel.type === "parent-child") {
        if (rel.child === personId) {
          rel.parents.forEach((pid) => {
            const par = peopleById.get(pid);
            if (par) parents.push(par);
          });
        }
        if (rel.parents.includes(personId)) {
          const ch = peopleById.get(rel.child);
          if (ch) children.push(ch);
        }
      }
    });

    const parentIds = parents.map((p) => p.id);

    // Find siblings (share at least one parent)
    if (parentIds.length > 0) {
      DATA.relationships.forEach((rel) => {
        if (rel.type === "parent-child" && rel.child !== personId) {
          if (rel.parents.some((pid) => parentIds.includes(pid))) {
            const sib = peopleById.get(rel.child);
            if (sib) siblings.add(sib);
          }
        }
      });
    }

    // Find grandparents (parents of parents)
    const grandparentIds = new Set();
    if (parentIds.length > 0) {
      DATA.relationships.forEach((rel) => {
        if (rel.type === "parent-child" && parentIds.includes(rel.child)) {
          rel.parents.forEach((gpid) => {
            const gp = peopleById.get(gpid);
            if (gp) {
              grandparents.add(gp);
              grandparentIds.add(gpid);
            }
          });
        }
      });
    }

    // Find uncles & aunts (siblings of parents + their spouses) and cousins (their children)
    const bloodUncleAuntIds = new Set();
    if (grandparentIds.size > 0) {
      DATA.relationships.forEach((rel) => {
        if (
          rel.type === "parent-child" &&
          !parentIds.includes(rel.child) &&
          rel.parents.some((gpid) => grandparentIds.has(gpid))
        ) {
          const ua = peopleById.get(rel.child);
          if (ua) {
            unclesAunts.add(ua);
            bloodUncleAuntIds.add(ua.id);
          }
        }
      });

      // Spouses of blood uncles/aunts
      DATA.relationships.forEach((rel) => {
        if (rel.type === "marriage") {
          if (bloodUncleAuntIds.has(rel.partner1) && !parentIds.includes(rel.partner2)) {
            const sp = peopleById.get(rel.partner2);
            if (sp) unclesAunts.add(sp);
          } else if (bloodUncleAuntIds.has(rel.partner2) && !parentIds.includes(rel.partner1)) {
            const sp = peopleById.get(rel.partner1);
            if (sp) unclesAunts.add(sp);
          }
        }
      });

      // Cousins (children of blood uncles/aunts)
      DATA.relationships.forEach((rel) => {
        if (
          rel.type === "parent-child" &&
          rel.parents.some((pid) => bloodUncleAuntIds.has(pid))
        ) {
          const cous = peopleById.get(rel.child);
          if (cous) cousins.add(cous);
        }
      });
    }

    // Find nephews & nieces (children of siblings or spouse's siblings)
    const siblingIds = new Set(Array.from(siblings).map((s) => s.id));
    spouses.forEach((spObj) => {
      if (!spObj.person) return;
      const spParents = [];
      DATA.relationships.forEach((rel) => {
        if (rel.type === "parent-child" && rel.child === spObj.person.id) {
          rel.parents.forEach((pid) => spParents.push(pid));
        }
      });
      if (spParents.length > 0) {
        DATA.relationships.forEach((rel) => {
          if (
            rel.type === "parent-child" &&
            rel.child !== spObj.person.id &&
            rel.parents.some((pid) => spParents.includes(pid))
          ) {
            siblingIds.add(rel.child);
          }
        });
      }
    });

    if (siblingIds.size > 0) {
      DATA.relationships.forEach((rel) => {
        if (
          rel.type === "parent-child" &&
          rel.parents.some((pid) => siblingIds.has(pid))
        ) {
          const nn = peopleById.get(rel.child);
          if (nn) nephewsNieces.add(nn);
        }
      });
    }

    // Find grandchildren (children of children)
    const childIds = new Set(children.map((c) => c.id));
    if (childIds.size > 0) {
      DATA.relationships.forEach((rel) => {
        if (
          rel.type === "parent-child" &&
          rel.parents.some((pid) => childIds.has(pid))
        ) {
          const gc = peopleById.get(rel.child);
          if (gc) grandchildren.add(gc);
        }
      });
    }

    return {
      parents,
      spouses: spouses.filter((s) => Boolean(s.person)),
      children,
      siblings: Array.from(siblings),
      grandparents: Array.from(grandparents),
      grandchildren: Array.from(grandchildren),
      unclesAunts: Array.from(unclesAunts),
      cousins: Array.from(cousins),
      nephewsNieces: Array.from(nephewsNieces)
    };
  }

  // =========================================================================
  // TREE LAYOUT & RENDERING ENGINE
  // =========================================================================

  const NODE_WIDTH = 236;
  const NODE_HEIGHT = 116;
  const H_GAP = 40;
  const COUPLE_GAP = 54;
  const GEN_ROW_HEIGHT = 212;
  const LANE_PADDING_X = 45;
  const LANE_HEADER_OFFSET = 96;

  const GENERATION_LABELS = {
    1: "1. Generation · ca. 1775–1800 (Ur-Ahnen)",
    2: "2. Generation · ca. 1801–1835 (3x-Urgroßeltern)",
    3: "3. Generation · ca. 1850–1866 (Ururgroßeltern)",
    4: "4. Generation · ca. 1890–1910 (Urgroßeltern)",
    5: "5. Generation · ab ca. 1935 (Großeltern)",
    6: "6. Generation · Elterngeneration",
    7: "7. Generation · Gegenwart"
  };

  function computeTreeLayout() {
    const visibleBranches =
      activeBranchFilter === "all"
        ? DATA.branches
        : DATA.branches.filter((b) => b.id === activeBranchFilter);

    const nodePositions = new Map();
    const laneHeaders = [];

    let currentLaneX = 248; // Leave space on the left for Generation Axis labels

    visibleBranches.forEach((branch) => {
      const branchPeople = DATA.people.filter((p) => {
        if (p.branchId !== branch.id) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.displayName.toLowerCase().includes(q) ||
          (p.primaryLocation && p.primaryLocation.toLowerCase().includes(q)) ||
          (p.biography && p.biography.toLowerCase().includes(q)) ||
          (p.birthDate && p.birthDate.toLowerCase().includes(q))
        );
      });

      if (branchPeople.length === 0) return;

      // Group people in this branch by generation
      const byGen = new Map();
      branchPeople.forEach((p) => {
        const g = p.generation || 3;
        if (!byGen.has(g)) byGen.set(g, []);
        byGen.get(g).push(p);
      });

      // Order people within each generation so married couples sit next to each other
      let maxRowWidth = 360;
      const orderedByGen = new Map();

      byGen.forEach((list, gen) => {
        const visited = new Set();
        const ordered = [];

        list.forEach((person) => {
          if (visited.has(person.id)) return;
          visited.add(person.id);
          ordered.push({ person, isSpouseRight: false });

          // Check if person has a spouse in the same branch & generation
          DATA.relationships.forEach((rel) => {
            if (rel.type === "marriage") {
              const otherId =
                rel.partner1 === person.id
                  ? rel.partner2
                  : rel.partner2 === person.id
                  ? rel.partner1
                  : null;
              if (otherId && !visited.has(otherId)) {
                const otherPerson = list.find((cand) => cand.id === otherId);
                if (otherPerson) {
                  visited.add(otherId);
                  ordered.push({
                    person: otherPerson,
                    isSpouseRight: true,
                    marriageDate: rel.date
                  });
                }
              }
            }
          });
        });

        orderedByGen.set(gen, ordered);

        // Calculate width of this generation row
        let rowW = 0;
        ordered.forEach((item, idx) => {
          if (idx > 0) {
            rowW += item.isSpouseRight ? COUPLE_GAP : H_GAP;
          }
          rowW += NODE_WIDTH;
        });
        if (rowW > maxRowWidth) maxRowWidth = rowW;
      });

      // Position each generation row centered inside the branch lane
      orderedByGen.forEach((ordered, gen) => {
        let rowW = 0;
        ordered.forEach((item, idx) => {
          if (idx > 0) rowW += item.isSpouseRight ? COUPLE_GAP : H_GAP;
          rowW += NODE_WIDTH;
        });

        let startX = currentLaneX + (maxRowWidth - rowW) / 2;
        const y = LANE_HEADER_OFFSET + (gen - 1) * GEN_ROW_HEIGHT;

        ordered.forEach((item, idx) => {
          if (idx > 0) {
            startX += item.isSpouseRight ? COUPLE_GAP : H_GAP;
          }
          nodePositions.set(item.person.id, {
            x: startX,
            y,
            person: item.person,
            branch
          });
          startX += NODE_WIDTH;
        });
      });

      laneHeaders.push({
        branch,
        x: currentLaneX,
        width: maxRowWidth
      });

      currentLaneX += maxRowWidth + LANE_PADDING_X * 1.6;
    });

    return {
      nodePositions,
      laneHeaders,
      totalWidth: Math.max(currentLaneX + 100, 1200),
      totalHeight: LANE_HEADER_OFFSET + 7 * GEN_ROW_HEIGHT + 90
    };
  }

  function fitTreeToViewport() {
    const viewport = document.getElementById("tree-viewport");
    if (!viewport) return;
    const layout = computeTreeLayout();
    const vpWidth = viewport.clientWidth || 1200;
    const vpHeight = viewport.clientHeight || 760;

    if (activeBranchFilter !== "all" && layout.laneHeaders.length === 1) {
      const lh = layout.laneHeaders[0];
      const contentWidth = lh.x + lh.width + 60;
      const idealScale = Math.min(0.92, Math.max(0.52, (vpWidth - 40) / contentWidth));
      scale = idealScale;
      panX = Math.max(12, (vpWidth - contentWidth * scale) / 2);
      panY = 18;
    } else {
      scale = Math.min(0.75, Math.max(0.38, vpWidth / Math.min(layout.totalWidth, 2600)));
      panX = 24;
      panY = 18;
    }
    applyCanvasTransform();
  }

  function focusPersonInTree(personId) {
    const viewport = document.getElementById("tree-viewport");
    if (!viewport) return;
    const person = peopleById.get(personId);
    if (!person) return;

    if (activeBranchFilter !== "all" && activeBranchFilter !== person.branchId) {
      activeBranchFilter = person.branchId;
      renderBranchFilters();
      renderActiveBranchBanner();
    }

    selectedPersonId = personId;
    renderTree();

    const layout = computeTreeLayout();
    const pos = layout.nodePositions.get(personId);
    if (!pos) return;

    const vpWidth = viewport.clientWidth || 1200;
    const vpHeight = viewport.clientHeight || 760;
    scale = 0.88;
    panX = vpWidth / 2 - (pos.x + NODE_WIDTH / 2) * scale;
    panY = vpHeight / 2 - (pos.y + NODE_HEIGHT / 2) * scale;
    applyCanvasTransform();
  }

  function renderTree() {
    const canvas = document.getElementById("tree-canvas");
    const bandsLayer = document.getElementById("tree-bands-layer");
    const svgLayer = document.getElementById("tree-svg-layer");
    const nodesContainer = document.getElementById("tree-nodes-container");
    if (!canvas || !svgLayer || !nodesContainer) return;

    const layout = computeTreeLayout();
    svgLayer.setAttribute("width", layout.totalWidth);
    svgLayer.setAttribute("height", layout.totalHeight);
    svgLayer.innerHTML = "";
    nodesContainer.innerHTML = "";
    if (bandsLayer) {
      bandsLayer.style.width = `${layout.totalWidth}px`;
      bandsLayer.style.height = `${layout.totalHeight}px`;
      bandsLayer.innerHTML = "";
    }

    // 1. Render Generation Swimlane Bands & Axis Badges
    for (let gen = 1; gen <= 7; gen++) {
      const bandTop = LANE_HEADER_OFFSET + (gen - 1) * GEN_ROW_HEIGHT - 22;
      if (bandsLayer) {
        const band = document.createElement("div");
        band.className = "generation-row-band" + (gen % 2 === 0 ? " even" : "");
        band.style.top = `${bandTop}px`;
        band.style.width = `${layout.totalWidth}px`;
        band.style.height = `${GEN_ROW_HEIGHT}px`;
        bandsLayer.appendChild(band);
      }

      const y = LANE_HEADER_OFFSET + (gen - 1) * GEN_ROW_HEIGHT + 36;
      const badge = document.createElement("div");
      badge.className = "generation-badge-axis";
      badge.style.left = "16px";
      badge.style.top = `${y}px`;
      badge.textContent = GENERATION_LABELS[gen];
      nodesContainer.appendChild(badge);
    }

    // 2. Render Branch Lane Headers
    layout.laneHeaders.forEach((lh) => {
      const headerEl = document.createElement("div");
      headerEl.className = "branch-lane-header";
      headerEl.style.left = `${lh.x}px`;
      headerEl.style.top = "14px";
      headerEl.style.width = `${lh.width}px`;
      headerEl.style.borderLeftColor = lh.branch.color;
      headerEl.innerHTML = `
        <div class="branch-lane-title">${lh.branch.name}</div>
        <div class="branch-lane-sub">${lh.branch.region} · ${lh.branch.period}</div>
      `;
      nodesContainer.appendChild(headerEl);
    });

    // 3. Render SVG Connectors (Marriages & Parent-Child Lines)
    const svgPaths = [];

    DATA.relationships.forEach((rel) => {
      if (rel.type === "marriage") {
        const p1 = layout.nodePositions.get(rel.partner1);
        const p2 = layout.nodePositions.get(rel.partner2);
        if (!p1 || !p2) return;

        const left = p1.x < p2.x ? p1 : p2;
        const right = p1.x < p2.x ? p2 : p1;

        const x1 = left.x + NODE_WIDTH;
        const y1 = left.y + NODE_HEIGHT / 2;
        const x2 = right.x;
        const y2 = right.y + NODE_HEIGHT / 2;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
        path.setAttribute("class", "connector-path marriage-line");
        path.setAttribute("data-people", `${rel.partner1},${rel.partner2}`);
        svgLayer.appendChild(path);
        svgPaths.push(path);

        // Marriage ring badge
        const pill = document.createElement("div");
        pill.className = "marriage-pill";
        pill.style.left = `${(x1 + x2) / 2}px`;
        pill.style.top = `${(y1 + y2) / 2}px`;
        pill.textContent = rel.pillText
          ? rel.pillText
          : rel.date
          ? `⚭ ${rel.date}`
          : "⚭";
        nodesContainer.appendChild(pill);
      } else if (rel.type === "parent-child") {
        const childPos = layout.nodePositions.get(rel.child);
        if (!childPos) return;

        const presentParents = rel.parents
          .map((pid) => layout.nodePositions.get(pid))
          .filter(Boolean);
        if (presentParents.length === 0) return;

        let startX, startY;
        if (presentParents.length === 2) {
          const left =
            presentParents[0].x < presentParents[1].x
              ? presentParents[0]
              : presentParents[1];
          const right =
            presentParents[0].x < presentParents[1].x
              ? presentParents[1]
              : presentParents[0];
          startX = (left.x + NODE_WIDTH + right.x) / 2;
          startY = left.y + NODE_HEIGHT / 2;
        } else {
          startX = presentParents[0].x + NODE_WIDTH / 2;
          startY = presentParents[0].y + NODE_HEIGHT;
        }

        const endX = childPos.x + NODE_WIDTH / 2;
        const endY = childPos.y;
        const midY = startY + (endY - startY) * 0.54;

        const isDirectConnector =
          DIRECT_ANCESTOR_ROLES[rel.child]?.direct &&
          rel.parents.some((pid) => DIRECT_ANCESTOR_ROLES[pid]?.direct);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute(
          "d",
          `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
        );
        path.setAttribute(
          "class",
          "connector-path" + (isDirectConnector ? " direct-line-connector" : "")
        );
        path.setAttribute("data-people", [...rel.parents, rel.child].join(","));
        svgLayer.appendChild(path);
        svgPaths.push(path);
      }
    });

    // 4. Render Person Nodes
    layout.nodePositions.forEach((pos) => {
      const person = pos.person;
      const photoUrl = getPersonPhoto(person.id);
      const roleInfo = DIRECT_ANCESTOR_ROLES[person.id];
      const isDirectAncestor = Boolean(roleInfo && roleInfo.direct);

      const node = document.createElement("div");
      node.className =
        "tree-node" +
        (isDirectAncestor ? " direct-ancestor-node" : "") +
        (selectedPersonId === person.id ? " selected" : "");
      node.style.left = `${pos.x}px`;
      node.style.top = `${pos.y}px`;
      node.style.borderTop = `3.5px solid ${
        isDirectAncestor ? "var(--accent-gold)" : pos.branch.color
      }`;

      const birthNameLine = person.maidenName
        ? `<div class="node-birthname">geb. ${person.maidenName}</div>`
        : person.marriedName && person.marriedName !== person.lastName
        ? `<div class="node-birthname">geb. ${person.lastName}</div>`
        : "";

      const kinshipPillHtml = roleInfo
        ? `<span class="node-kinship-pill ${
            roleInfo.direct ? "" : "collateral"
          }">${roleInfo.label}</span>`
        : "";

      const galleryCount = (person.gallery || []).length;
      const sourceCount =
        (person.sources || []).length + (customArticles[person.id] || []).length;

      node.innerHTML = `
        ${kinshipPillHtml}
        <div class="tree-node-top">
          <div class="node-avatar">
            ${
              photoUrl
                ? `<img src="${photoUrl}" alt="${person.displayName}" />`
                : `<span class="node-initials">${getInitials(person)}</span>`
            }
          </div>
          <div class="node-info">
            <div class="node-name">${person.firstName} ${
        person.marriedName || person.lastName
      }</div>
            ${birthNameLine}
            <div class="node-dates">${formatLifespan(person)}</div>
          </div>
        </div>
        <div class="node-footer">
          <span class="node-location" title="${person.primaryLocation || ""}">📍 ${
        person.primaryLocation || "Ort dokumentiert"
      }</span>
          <div class="node-badges-right">
            ${
              galleryCount > 0
                ? `<span class="node-mini-badge" title="${galleryCount} historische Fotos">📸 ${galleryCount}</span>`
                : ""
            }
            ${
              sourceCount > 0
                ? `<span class="node-mini-badge" title="${sourceCount} Urkunden/Quellen">📜 ${sourceCount}</span>`
                : ""
            }
            <span class="node-action-hint">→</span>
          </div>
        </div>
      `;

      // Hover highlight for connected family lines
      node.addEventListener("mouseenter", () => {
        svgPaths.forEach((p) => {
          const ids = (p.getAttribute("data-people") || "").split(",");
          if (ids.includes(person.id)) {
            p.classList.add("highlighted");
            p.classList.remove("dimmed");
          } else {
            p.classList.add("dimmed");
            p.classList.remove("highlighted");
          }
        });
      });

      node.addEventListener("mouseleave", () => {
        svgPaths.forEach((p) => {
          p.classList.remove("highlighted", "dimmed");
        });
      });

      node.addEventListener("click", (e) => {
        e.stopPropagation();
        openPersonModal(person.id);
      });

      nodesContainer.appendChild(node);
    });

    applyCanvasTransform();
  }

  function applyCanvasTransform() {
    const canvas = document.getElementById("tree-canvas");
    if (!canvas) return;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const zoomIndicator = document.getElementById("zoom-level-indicator");
    if (zoomIndicator) {
      zoomIndicator.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  // =========================================================================
  // 7-GENERATION LINEAGE COMPASS & ACTIVE BRANCH CONTEXT BANNER
  // =========================================================================

  function renderLineageStepper() {
    const track = document.getElementById("lineage-stepper-track");
    if (!track) return;

    track.innerHTML = LINEAGE_STEPS.map(
      (step) => `
      <button class="lineage-step" data-focus-id="${step.focusId}">
        <span class="lineage-step-gen">${step.period}</span>
        <span class="lineage-step-names">${step.names}</span>
        <span class="lineage-step-place">📍 ${step.place}</span>
      </button>
    `
    ).join("");

    track.querySelectorAll(".lineage-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fid = btn.getAttribute("data-focus-id");
        if (fid) {
          switchView("tree");
          focusPersonInTree(fid);
        }
      });
    });
  }

  function renderActiveBranchBanner() {
    const banner = document.getElementById("active-branch-banner");
    if (!banner) return;

    if (activeBranchFilter === "all") {
      banner.innerHTML = `
        <div>
          <div class="active-branch-title">Alle 8 dokumentierten Familienzweige im Gesamtüberblick (${DATA.people.length} Personen)</div>
          <div class="active-branch-desc">
            Links siehst du unsere <strong>direkte 7-Generationen-Stammlinie (Lemgo – Heiden – Bremen – Gegenwart)</strong>, rechts daneben die historischen lippischen Seitenlinien (Lage, Hillentrup, Hohenhausen) sowie die Zweige in Minden, Wien, Norddeutschland und den USA.
          </div>
        </div>
        <span class="active-branch-relation-pill">Gesamtarchiv · 1775–Gegenwart</span>
      `;
      return;
    }

    const b = branchesById.get(activeBranchFilter);
    if (!b) return;

    const isDirect = b.id === "bremen";
    const relationNote = isDirect
      ? "★ 100 % direkte & lückenlos belegte Blutlinie (7 Generationen)"
      : "Historische Seitenlinie · Gemeinsamer lippischer Ursprung (Raum Lemgo/Lage)";

    banner.style.borderLeftColor = b.color;
    banner.innerHTML = `
      <div>
        <div class="active-branch-title">${b.name} (${b.period})</div>
        <div class="active-branch-desc">${b.description}</div>
      </div>
      <span class="active-branch-relation-pill">${relationNote}</span>
    `;
  }

  // =========================================================================
  // PAN & ZOOM INTERACTION (MOUSE + TOUCH + FULLSCREEN)
  // =========================================================================

  function initTreeViewportInteractions() {
    const viewport = document.getElementById("tree-viewport");
    if (!viewport) return;

    viewport.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tree-node")) return;
      isDragging = true;
      viewport.classList.add("dragging");
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      applyCanvasTransform();
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      viewport.classList.remove("dragging");
    });

    // Touch pan support for tablets/smartphones
    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest(".tree-node") || e.touches.length !== 1) return;
        isDragging = true;
        dragStartX = e.touches[0].clientX - panX;
        dragStartY = e.touches[0].clientY - panY;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchmove",
      (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        panX = e.touches[0].clientX - dragStartX;
        panY = e.touches[0].clientY - dragStartY;
        applyCanvasTransform();
      },
      { passive: true }
    );

    viewport.addEventListener("touchend", () => {
      isDragging = false;
    });

    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const newScale = Math.min(1.6, Math.max(0.32, scale * zoomFactor));

        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        panX = mouseX - ((mouseX - panX) / scale) * newScale;
        panY = mouseY - ((mouseY - panY) / scale) * newScale;
        scale = newScale;
        applyCanvasTransform();
      },
      { passive: false }
    );

    document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
      scale = Math.min(1.6, scale * 1.15);
      applyCanvasTransform();
    });

    document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
      scale = Math.max(0.32, scale * 0.85);
      applyCanvasTransform();
    });

    document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
      fitTreeToViewport();
    });

    document.getElementById("btn-tree-fullscreen")?.addEventListener("click", () => {
      viewport.classList.toggle("fullscreen-mode");
      const btn = document.getElementById("btn-tree-fullscreen");
      if (btn) {
        btn.textContent = viewport.classList.contains("fullscreen-mode")
          ? "✕ Vollbild beenden"
          : "⛶ Vollbild";
      }
      setTimeout(() => fitTreeToViewport(), 60);
    });

    document.getElementById("btn-focus-noah")?.addEventListener("click", () => {
      focusPersonInTree("noah-elias-kruegermeyer");
    });
  }

  // =========================================================================
  // EDITORIAL FAMILY CHRONICLE VIEW (6 ILLUSTRATED CHAPTERS)
  // =========================================================================

  function renderChronicleView() {
    const container = document.getElementById("chronicle-container");
    if (!container) return;

    const chapters = [
      {
        eyebrow: "1. Kapitel · Namensursprung & 1. Generation (um 1775–1801)",
        title: "Der lippische Hof- und Stättenname „Krügermeyer“ in Lemgo",
        prose: [
          "Der Familienname <strong>Krügermeyer</strong> gehört zu den charakteristischen westfälisch-lippischen Doppelnamen, die im ehemaligen <strong>Fürstentum Lippe</strong> aus der Verbindung zweier traditionsreicher Ämter hervorgingen: dem <em>Krüger</em> (Inhaber eines privilegierten Landkrugs bzw. Gast- und Brauhauses) und dem <em>Meyer</em> (Verwalter oder Bewirtschafter eines landesherrlichen oder kirchlichen Haupthofes). Im Gegensatz zu Allerweltsnamen entstand der Name Krügermeyer weltweit nur in einem einzigen geografischen Kerngebiet von knapp zehn Kilometern Durchmesser rund um die Alte Hansestadt <strong>Lemgo</strong>.",
          "An der Spitze unserer urkundlich gesicherten Stammreihe stehen in der 1. Generation <strong>Johann Christoph Krügermeyer</strong> (* um 1775 in Lemgo) und seine Ehefrau <strong>Anna Maria Elisabeth geb. Priester</strong>, die im <strong>Mai 1801</strong> in der evangelisch-lutherischen Stadtkirche <strong>St. Nicolai zu Lemgo</strong> ihre Tochter Anna Maria Ilsabein taufen ließen. Parallel lebten im benachbarten lippischen Kirchdorf <strong>Heiden</strong> unsere Vorfahren <strong>Johann Christoph Diekmann</strong> (Landwirt) und <strong>Amalie Sophie Luise geb. Heßloh</strong> sowie in der Freien Hansestadt <strong>Bremen</strong> unsere Vorfahren <strong>Johann Friedrich Christoph Meyne</strong> (1789–1868) und <strong>Maria Margreta geb. Müller</strong> (1789–1851)."
        ],
        personIds: [
          "johann-christoph-kruegermeyer-1775",
          "anna-maria-elisabeth-priester-1778",
          "johann-christoph-diekmann-1795",
          "johann-friedrich-christoph-meyne-1789"
        ],
        photo: null
      },
      {
        eyebrow: "2. Kapitel · 2. Generation in Lemgo & Heiden (1813–1917)",
        title: "Die Lemgoer Bleicherei von Henrich Christoph Krügermeyer & Amalia geb. Diekmann",
        prose: [
          "Unser 3x-Urgroßvater <strong>Henrich Christoph Krügermeyer</strong> (* 13. Januar 1813 in Lemgo, † 9. Januar 1887 in Lemgo) war angesehene Bürger und <strong>Bleichereibesitzer</strong> in Lemgo. Das Leinengewerbe und die Garn- und Tuchbleiche an den Wasserläufen der Bega bildeten im 19. Jahrhundert das wirtschaftliche Rückgrat des Fürstentums Lippe.",
          "Um 1852 heiratete er <strong>Amalia Florentine Henriette Diekmann</strong> (* 7. Februar 1829 in Heiden, † 12. April 1917 in Lemgo). Sie überlebte ihren Ehemann um dreißig Jahre und wohnte zuletzt im Familienhaus in der <strong>Rampendahlstraße 43 in Lemgo</strong>, wo sie 1917 im hohen Alter von 88 Jahren verstarb. Ihre drei Söhne waren unser Ururgroßvater <strong>Ernst Simon Krügermeyer</strong> (* 1859), der Lemgoer Kaufmann <strong>Heinrich Krügermeyer jun.</strong> (* ca. 1863, der 1917 den Tod seiner Mutter beim Standesamt Lemgo anzeigte) sowie der nach Elberfeld gezogene Kaufmann <strong>August Krügermeyer gen. Kuhlmann</strong> (1860–1917)."
        ],
        personIds: [
          "heinrich-kruegermeyer-1825",
          "amalie-florentine-henriette-diekmann-1829",
          "heinrich-kruegermeyer-jun-1863",
          "philipp-heinrich-meyne-1823"
        ],
        photo: null
      },
      {
        eyebrow: "3. Kapitel · 3. Generation: Aufbruch nach Bremen (1886–1955)",
        title: "Ernst Simon Krügermeyer (1859–1949) & die Gründung von „Ernst Krügermeyer & Co. Bremen“",
        prose: [
          "Mit unserem Ururgroßvater <strong>Ernst Simon Krügermeyer</strong> (* 13. Oktober 1859 in Lemgo, † 23. November 1949 in Bremen) verlagerte sich der Lebensmittelpunkt unserer direkten Stammlinie von Lippe in die aufstrebende Welthandels- und Hafenstadt <strong>Bremen</strong>.",
          "Bereits im Jahr <strong>1886</strong> gründete er im Alter von 26 Jahren das Großhandels- und Fabrikationsunternehmen <strong>„Ernst Krügermeyer & Co. Bremen“</strong>. Am <strong>5. Juni 1889</strong> heiratete er in Bremen <strong>Meta Margarethe Meyne</strong> (* 20. Januar 1866 in Bremen, † 11. Januar 1955 in Bremen), Tochter von Philipp Heinrich Meyne und Meta Margarethe geb. Eschenbach. Die Familie residierte im repräsentativen Bremer Bürgerhaus in der <strong>Herderstraße 57</strong>. Im Juni 1939 feierten Ernst Simon und Meta Margarethe in Bremen ihre Goldene Hochzeit; Ernst Simon verstarb 1949 mit 90 Jahren, Meta Margarethe 1955 kurz vor ihrem 89. Geburtstag."
        ],
        personIds: [
          "ernst-kruegermeyer-1859",
          "meta-margarethe-meyne-1866",
          "johannes-heinrich-wilhelm-kruegermeyer-1891",
          "meta-margarethe-amalie-kruegermeyer-1890"
        ],
        photo: {
          src: "assets/photos/meta_meyne_kinder_1943.jpg",
          title: "Ururgroßmutter Meta Margarethe Krügermeyer geb. Meyne (1866–1955)",
          caption: "Aufnahme aus dem Sommer 1943 mit ihren beiden Urenkeln Helmut und Haide Krügermeyer."
        }
      },
      {
        eyebrow: "4. Kapitel · 4. Generation: Die Bremer Zwillingsbrüder (1907–1998)",
        title: "Urgroßvater Herbert Gustav Krügermeyer (1907–1998), Christel Krügermeyer & Zwillingsbruder Ernst Otto",
        prose: [
          "Am <strong>6. November 1907</strong> kamen im Elternhaus in Bremen die Zwillingsbrüder <strong>Herbert Gustav Krügermeyer</strong> (unser Urgroßvater, Standesamt Bremen 1 Nr. 4969) und <strong>Ernst Otto Krügermeyer</strong> (Nr. 4968) zur Welt. Beide wurden am 2. Weihnachtsfeiertag, dem 26. Dezember 1907, durch Pastor Kranig getauft.",
          "Unser Urgroßvater <strong>Herbert „Herbie“ Gustav Krügermeyer</strong> arbeitete als kaufmännischer Angestellter und heiratete im <strong>November 1939</strong> vor dem Standesamt <strong>Berlin-Prenzlauer Berg</strong> (Nr. 3328/1939) unsere Urgroßmutter <strong>Frau Christel Krügermeyer</strong>. Aus ihrer Ehe gingen unser Großvater <strong>Gerd Krügermeyer</strong> und unser Großonkel <strong>Dr. Lutz Krügermeyer</strong> hervor (ein weiterer Sohn, Jens-Peter, * 27.12.1944 in Berlin, verstarb in den Nachkriegswirren am 23.11.1945 in Jena). Herbert Gustav Krügermeyer kehrte nach Bremen zurück und verstarb dort 1998 im hohen Alter von 90 Jahren.",
          "Sein Zwillingsbruder <strong>Ernst Otto Krügermeyer</strong> (1907–1995) übernahm 1936 als persönlich haftender Gesellschafter die väterliche Firma <em>Ernst Krügermeyer & Co.</em> in Bremen und heiratete am 6. April 1937 <strong>Charlotte „Lotte“ geb. Weber</strong> (1910–1997), mit der er die Kinder <strong>Helmut Krügermeyer</strong> und <strong>Haide Hecker geb. Krügermeyer</strong> (Mutter von Moena und Vanessa Hecker) bekam."
        ],
        personIds: [
          "herbert-gustav-kruegermeyer-1907",
          "christel-kruegermeyer-bremen",
          "ernst-otto-kruegermeyer-1907",
          "charlotte-weber-1910"
        ],
        photo: {
          src: "assets/photos/ernst_otto_1943.jpg",
          title: "Ernst Otto Krügermeyer (Zwillingsbruder von Urgroßvater Herbert Gustav) im Mai 1943",
          caption: "Aufnahme mit seinen Kindern Helmut und Haide im Mai 1943."
        }
      },
      {
        eyebrow: "5. Kapitel · 5., 6. & 7. Generation: Aus dem Raum Bremen über Hannover & Köln zur heutigen 7. Generation",
        title: "Großeltern Gerd & Vera-Theresia, Eltern Aike-Kristian & Claudia, Onkel Lars & Jasmin und die 7. Generation",
        prose: [
          "In der 5. Generation führten unser Großvater <strong>Gerd Krügermeyer</strong> und unsere Großmutter <strong>Vera-Theresia Krügermeyer</strong> (ansässig im Raum Bremen und Hambergen bei Bremen, mit ihren geliebten privaten Ferienhäusern auf Mallorca und Formentera) die Linie weiter, während Gerds Bruder <strong>Dr. Lutz Krügermeyer</strong> als promovierter Meteorologe und Meeresforscher an der Universität Hamburg internationale Meeresexpeditionen begleitete.",
          "Die beiden Söhne von Gerd und Vera-Theresia Krügermeyer bilden die 6. Generation: <strong>Aike-Kristian Krügermeyer</strong> (verheiratet mit <strong>Lidia Krügermeyer</strong>, geboren in <strong>Warschau</strong>) wurde in <strong>Hannover</strong> geboren, sein Bruder <strong>Lars Krügermeyer</strong> in <strong>Köln</strong>.",
          "In der <strong>7. Generation</strong> schließt sich der historische Kreis wieder in der alten Familienheimat <strong>Bremen</strong>: Sowohl <strong>Noah-Elias Krügermeyer</strong> und sein Bruder <strong>Leon-Bennet Krügermeyer</strong> (Söhne von <strong>Aike-Kristian Krügermeyer</strong> und <strong>Claudia Krügermeyer geb. Hentschel</strong>, Stiefsöhne von <strong>Lidia Krügermeyer</strong>) als auch ihre beiden Cousins <strong>Luca Krügermeyer</strong> und <strong>Lino Valentino Krügermeyer</strong> (Söhne von Onkel <strong>Lars Krügermeyer</strong> und Tante <strong>Jasmin Krügermeyer</strong>) wurden alle vier in <strong>Bremen</strong> geboren."
        ],
        personIds: [
          "gerd-kruegermeyer-1940",
          "vera-theresia-kruegermeyer-1942",
          "lutz-kruegermeyer-1942",
          "aike-kristian-kruegermeyer-1970",
          "lidia-kruegermeyer",
          "claudia-kruegermeyer-hentschel",
          "lars-kruegermeyer-1972",
          "jasmin-kruegermeyer",
          "noah-elias-kruegermeyer",
          "leon-bennet-kruegermeyer",
          "luca-kruegermeyer",
          "lino-valentino-kruegermeyer"
        ],
        photo: null
      },
      {
        eyebrow: "6. Kapitel · Die historischen lippischen Seitenlinien (Lage, Hillentrup, Minden & Übersee)",
        title: "Wie die anderen Krügermeyer-Zweige mit unserer Stammlinie zusammenhängen",
        prose: [
          "Da sämtliche historischen Träger des Namens <strong>Krügermeyer</strong> aus den direkt aneinandergrenzenden lippischen Kirchspielen <strong>Lemgo, Heiden, Lage, Hillentrup und Hohenhausen</strong> stammen und selbst die traditionellen Leit-Vornamen (wie <em>Simon</em>, <em>Christoph</em>, <em>Heinrich</em> und <em>August</em>) identisch sind, gehen diese Zweige mit höchster Wahrscheinlichkeit im 18. Jahrhundert auf denselben lippischen Ur-Hof zurück:",
          "• <strong>Kaufmannsdynastie „S. A. Krügermeyer“ in Lage (gegr. 1847):</strong> Gegründet von <strong>Simon August Krügermeyer</strong> (* ca. 1820) in der Langestraße 71 in Lage (nur 5 km von Heiden entfernt), weitergeführt über <strong>Friedrich August Krügermeyer</strong> (1851–1937) und <strong>Gustav Krügermeyer</strong> bis ins späte 20. Jahrhundert.<br/>• <strong>Ziegler-Linie Hillentrup / Dörentrup:</strong> Begründet durch <strong>Johann Bernd Krügermeyer</strong> (* ca. 1805) in Hillentrup (7 km nördlich von Lemgo).<br/>• <strong>Linie Minden & Transatlantische Auswanderer:</strong> Vom lippisch-westfälischen Grenzraum zog ein Zweig nach Minden (Preußen), während einzelne Namensträger ab 1882 über den Bremer Hafen bis nach <strong>New York City</strong> und <strong>Oak Harbor (Ohio)</strong> auswanderten."
        ],
        personIds: [
          "simon-august-kruegermeyer-1820",
          "friedrich-august-kruegermeyer-1851",
          "johann-bernd-kruegermeyer-1805",
          "emil-kruegermeyer-1859"
        ],
        photo: null
      }
    ];

    container.innerHTML = `
      <div class="chronicle-intro-card">
        <div class="hero-eyebrow" style="margin-bottom:0.65rem;">✦ Große Familienchronik Krügermeyer (1775 – Gegenwart)</div>
        <h2>Über 250 Jahre Familiengeschichte in sechs Kapiteln</h2>
        <p>
          Von den Bleichwiesen an der Bega in Lemgo und den Höfen in Heiden über die Gründung des Bremer Handelshauses <em>„Ernst Krügermeyer &amp; Co.“</em> im Kaiserreich 1886 bis zur heutigen 7. Generation in Bremen: Diese Chronik verbindet alle historischen Urkunden, Kirchenbucheinträge, Zeitungsberichte und Familienerinnerungen zu einer durchgehenden Erzählung.
        </p>
      </div>
      ${chapters
        .map(
          (ch) => `
        <article class="chronicle-chapter ${ch.photo ? "with-photo" : ""}">
          <div>
            <div class="chapter-eyebrow">${ch.eyebrow}</div>
            <h3 class="chapter-title">${ch.title}</h3>
            <div class="chapter-prose">
              ${ch.prose.map((p) => `<p>${p}</p>`).join("")}
            </div>
            <div class="chapter-people-links">
              ${ch.personIds
                .map((pid) => {
                  const p = peopleById.get(pid);
                  if (!p) return "";
                  return `<button class="chapter-person-btn" data-person-id="${p.id}">👤 ${p.displayName}</button>`;
                })
                .join("")}
            </div>
          </div>
          ${
            ch.photo
              ? `
            <div class="chapter-photo-box" data-full-src="${ch.photo.src}" data-caption="${ch.photo.title} – ${ch.photo.caption}">
              <img src="${ch.photo.src}" alt="${ch.photo.title}" loading="lazy" />
              <div class="chapter-photo-caption">
                <strong>${ch.photo.title}</strong><br/>
                ${ch.photo.caption}
              </div>
            </div>
          `
              : ""
          }
        </article>
      `
        )
        .join("")}
    `;

    container.querySelectorAll(".chapter-person-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pid = btn.getAttribute("data-person-id");
        if (pid) openPersonModal(pid);
      });
    });

    container.querySelectorAll(".chapter-photo-box").forEach((box) => {
      box.addEventListener("click", () => {
        const src = box.getAttribute("data-full-src");
        const caption = box.getAttribute("data-caption");
        if (src) openLightbox(src, caption);
      });
    });
  }

  // =========================================================================
  // SECONDARY VIEWS: BRANCH FILTERS, PEOPLE GRID, PLACES, ARCHIVE, PHOTOS
  // =========================================================================

  function renderBranchFilters() {
    const containers = [
      document.getElementById("branch-filter-list"),
      document.getElementById("people-branch-Subfilter")
    ].filter(Boolean);

    const directBranch = DATA.branches.find((b) => b.id === "bremen");
    const otherBranches = DATA.branches.filter((b) => b.id !== "bremen");
    const directCount = DATA.people.filter((p) => p.branchId === "bremen").length;

    let html = "";
    if (directBranch) {
      html += `
        <button class="filter-chip primary-branch ${
          activeBranchFilter === "bremen" ? "active" : ""
        }" data-branch="bremen">
          <span class="chip-dot" style="background:${directBranch.color}"></span>
          ★ Unsere direkte Stammlinie (${directCount})
        </button>
      `;
    }

    html += `<span class="filter-group-label">Seitenlinien:</span>`;

    otherBranches.forEach((b) => {
      const count = DATA.people.filter((p) => p.branchId === b.id).length;
      const shortTitle = b.name.replace(/^\d+\.\s*/, "").split("(")[0].trim();
      html += `
        <button class="filter-chip ${
          activeBranchFilter === b.id ? "active" : ""
        }" data-branch="${b.id}">
          <span class="chip-dot" style="background:${b.color}"></span>
          ${shortTitle} (${count})
        </button>
      `;
    });

    html += `
      <button class="filter-chip ${
        activeBranchFilter === "all" ? "active" : ""
      }" data-branch="all">
        Alle Zweige (${DATA.people.length})
      </button>
    `;

    containers.forEach((container) => {
      container.innerHTML = html;
      container.querySelectorAll(".filter-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeBranchFilter = btn.getAttribute("data-branch") || "bremen";
          renderBranchFilters();
          renderActiveBranchBanner();
          renderTree();
          fitTreeToViewport();
          renderPeopleGrid();
        });
      });
    });
  }

  function renderPeopleGrid() {
    const grid = document.getElementById("people-grid");
    if (!grid) return;

    const filtered = DATA.people.filter((p) => {
      if (activeBranchFilter !== "all" && p.branchId !== activeBranchFilter)
        return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.displayName.toLowerCase().includes(q) ||
        (p.primaryLocation && p.primaryLocation.toLowerCase().includes(q)) ||
        (p.biography && p.biography.toLowerCase().includes(q)) ||
        (p.birthDate && p.birthDate.toLowerCase().includes(q))
      );
    });

    grid.innerHTML = filtered
      .map((person) => {
        const photoUrl = getPersonPhoto(person.id);
        const branch = branchesById.get(person.branchId);
        const roleInfo = DIRECT_ANCESTOR_ROLES[person.id];
        const tagsHtml = (person.tags || [])
          .map((t) => `<span class="tag-badge">${t}</span>`)
          .join("");

        return `
        <article class="person-card ${
          roleInfo && roleInfo.direct ? "direct-card" : ""
        }" data-person-id="${person.id}">
          <div class="person-card-header">
            <div class="person-card-avatar">
              ${
                photoUrl
                  ? `<img src="${photoUrl}" alt="${person.displayName}" />`
                  : `<span class="node-initials">${getInitials(person)}</span>`
              }
            </div>
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:${
                branch ? branch.color : "var(--accent-gold)"
              };text-transform:uppercase;letter-spacing:0.05em;">
                ${roleInfo ? `★ ${roleInfo.label} · ` : ""}${branch ? branch.region : ""}
              </div>
              <h3 class="person-card-title">${person.displayName}</h3>
              <div class="person-card-meta">${formatLifespan(person)} · 📍 ${
          person.primaryLocation || ""
        }</div>
            </div>
          </div>
          <p class="person-card-summary">${person.shortSummary}</p>
          <div class="person-card-tags">${tagsHtml}</div>
        </article>
      `;
      })
      .join("");

    grid.querySelectorAll(".person-card").forEach((card) => {
      card.addEventListener("click", () => {
        const pid = card.getAttribute("data-person-id");
        if (pid) openPersonModal(pid);
      });
    });
  }

  function renderPlacesGrid() {
    const grid = document.getElementById("places-grid");
    if (!grid) return;

    grid.innerHTML = DATA.places
      .map(
        (place) => `
      <div class="place-card">
        <div class="place-header">
          <h3 class="place-name">📍 ${place.name}</h3>
          <span class="place-period">${place.period}</span>
        </div>
        <div class="place-region">${place.region} · ${place.count} dokumentierte Personen</div>
        <p class="place-desc">${place.description}</p>
      </div>
    `
      )
      .join("");
  }

  // =========================================================================
  // HISTORISCHES ZEITUNGSARCHIV & QUELLENBELEGE (1.000+ ARTIKEL & SCANS)
  // =========================================================================

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  let archiveCategory = "all";
  let archiveSearch = "";
  let archiveSort = "chronological";
  let archiveLimit = 48;
  let archiveToolbarInitialized = false;

  const ARCHIVE_CATEGORIES = [
    { id: "all", label: "Alle Quellen" },
    { id: "Todesanzeige & Nachruf", label: "Todesanzeigen & Nachrufe" },
    { id: "Kaufmann & Landhandel (S.A. Krügermeyer / Lage)", label: "Kaufmann & Handel (Lage)" },
    { id: "Amtlich, Kirche & Politik", label: "Amtlich & Kirche" },
    { id: "Immobilien, Versteigerungen & Anzeigen", label: "Immobilien & Anzeigen" },
    { id: "Militär, Auszeichnungen & Verlustlisten", label: "Militär & Verlustlisten" },
    { id: "Ernst Krügermeyer & Co. (Bremen & Kosmetik)", label: "Ernst Krügermeyer (Bremen)" },
    { id: "Gewerbe & Bleicherei (Kastanienwall / Lemgo)", label: "Bleicherei (Lemgo)" },
    { id: "Familiennachricht (Heirat / Geburt / Jubiläum)", label: "Familiennachrichten" },
    { id: "Urkunden & Register", label: "Kirchenbücher & Urkunden" }
  ];

  function renderArchiveGrid() {
    const grid = document.getElementById("archive-grid");
    if (!grid) return;

    // 1. Kirchenbuch- und Standesamtsquellen aus DATA.people
    const baseSources = [];
    DATA.people.forEach((person) => {
      (person.sources || []).forEach((src) => {
        const yearM = src.title ? src.title.match(/\b(1[789]\d\d|20\d\d)\b/) : null;
        baseSources.push({
          id: `src-${person.id}-${baseSources.length}`,
          personIds: [person.id],
          persons: [person],
          category: "Urkunden & Register",
          type: src.type,
          title: src.title,
          newspaper: src.type,
          date: src.date || "",
          year: yearM ? parseInt(yearM[1], 10) : null,
          location: person.primaryLocation || "",
          snippet: src.detail,
          quote: src.quote || null,
          image: null,
          originalArchive: "Kirchenbuch- & Standesamtsregister Lippe / Bremen",
          archiveUrl: null
        });
      });
      const extraArticles = customArticles[person.id] || [];
      extraArticles.forEach((art) => {
        baseSources.push({
          id: `custom-${person.id}-${baseSources.length}`,
          personIds: [person.id],
          persons: [person],
          category: "Familiennachricht (Heirat / Geburt / Jubiläum)",
          type: art.type || "Zeitungsartikel / Familienarchiv",
          title: art.title,
          newspaper: "Familienarchiv",
          date: "",
          year: null,
          location: person.primaryLocation || "",
          snippet: art.detail,
          quote: art.quote || null,
          image: art.image || null,
          originalArchive: "Familienbesitz Krügermeyer",
          archiveUrl: null
        });
      });
    });

    // 2. Historische Zeitungsartikel aus window.KRUEGERMEYER_ZEITUNGEN
    const newsArticles = (window.KRUEGERMEYER_ZEITUNGEN || []).map((art) => {
      const persons = (art.personIds || [])
        .map((pid) => peopleById.get(pid))
        .filter(Boolean);
      return {
        id: art.id,
        personIds: art.personIds || [],
        persons,
        category: art.category,
        type: art.category || "Historischer Zeitungsartikel",
        title: art.title,
        newspaper: art.newspaper,
        date: art.date,
        year: art.year,
        location: art.location,
        snippet: art.snippet,
        quote: null,
        image: art.image,
        originalArchive: art.originalArchive,
        archiveUrl: art.archiveUrl
      };
    });

    const allEntries = [...baseSources, ...newsArticles];

    // Globale Statistik-Zahl aktualisieren
    const statSources = document.getElementById("stat-sources-count");
    if (statSources) statSources.textContent = allEntries.length.toLocaleString("de-DE");

    // Toolbar Event-Listener einmalig initialisieren
    if (!archiveToolbarInitialized) {
      archiveToolbarInitialized = true;
      const searchInput = document.getElementById("archive-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          archiveSearch = e.target.value.toLowerCase().trim();
          archiveLimit = 48;
          renderArchiveGrid();
        });
      }

      const sortSelect = document.getElementById("archive-sort-select");
      if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
          archiveSort = e.target.value;
          renderArchiveGrid();
        });
      }

      const btnLoadMore = document.getElementById("btn-archive-load-more");
      if (btnLoadMore) {
        btnLoadMore.addEventListener("click", () => {
          archiveLimit += 48;
          renderArchiveGrid();
        });
      }
    }

    // Filter-Chips rendern
    const chipsContainer = document.getElementById("archive-category-chips");
    if (chipsContainer) {
      chipsContainer.innerHTML = ARCHIVE_CATEGORIES.map((cat) => {
        const count =
          cat.id === "all"
            ? allEntries.length
            : allEntries.filter((e) => e.category === cat.id).length;
        if (count === 0 && cat.id !== "all") return "";
        const isActive = archiveCategory === cat.id;
        return `
          <button class="archive-chip ${isActive ? "active" : ""}" data-category="${cat.id}">
            ${cat.label} (${count.toLocaleString("de-DE")})
          </button>
        `;
      }).join("");

      chipsContainer.querySelectorAll(".archive-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          archiveCategory = btn.getAttribute("data-category");
          archiveLimit = 48;
          renderArchiveGrid();
        });
      });
    }

    // Filter anwenden
    let filtered = allEntries;
    if (archiveCategory !== "all") {
      filtered = filtered.filter((e) => e.category === archiveCategory);
    }
    if (archiveSearch) {
      filtered = filtered.filter((e) => {
        const pNames = e.persons.map((p) => p.displayName.toLowerCase()).join(" ");
        const corpus = `${e.title} ${e.newspaper} ${e.snippet} ${e.location} ${e.date} ${pNames}`.toLowerCase();
        return corpus.includes(archiveSearch);
      });
    }

    // Sortierung
    if (archiveSort === "chronological") {
      filtered.sort((a, b) => {
        const ya = a.year || 9999;
        const yb = b.year || 9999;
        return ya - yb;
      });
    } else if (archiveSort === "newest") {
      filtered.sort((a, b) => {
        const ya = a.year || -9999;
        const yb = b.year || -9999;
        return yb - ya;
      });
    } else if (archiveSort === "matched") {
      filtered.sort((a, b) => (b.persons.length > 0 ? 1 : 0) - (a.persons.length > 0 ? 1 : 0));
    }

    // Status-Badge aktualisieren
    const badge = document.getElementById("archive-count-badge");
    if (badge) {
      const totalF = filtered.length;
      badge.textContent = `${totalF.toLocaleString("de-DE")} Quellen gefunden · Zeige ${Math.min(archiveLimit, totalF)} von ${totalF.toLocaleString("de-DE")}`;
    }

    // Limitieren für flüssiges Rendering
    const visibleEntries = filtered.slice(0, archiveLimit);

    // Grid rendern
    grid.innerHTML = visibleEntries
      .map((item) => {
        const personLinksHtml = (item.persons || [])
          .map(
            (p) => `
            <span class="archive-person-link" data-person-id="${p.id}" title="Personen-Dossier öffnen">
              👤 ${escapeHtml(p.displayName)}
            </span>
          `
          )
          .join(" ");

        return `
        <div class="archive-card">
          ${
            item.image
              ? `
            <div class="archive-card-thumb-wrap" data-full-src="${item.image}" data-caption="${escapeHtml(item.title + ' – ' + item.newspaper + ' (' + (item.date || item.year || '') + ')')}" title="Klicken für vergrößerten Original-Zeitungsscan">
              <img src="${item.image}" class="archive-card-thumb" alt="${escapeHtml(item.title)}" loading="lazy" />
              <div class="archive-card-zoom-hint">🔍 Originalscan vergrößern</div>
            </div>
          `
              : ""
          }
          <div class="archive-card-header">
            <span class="archive-news-tag">${escapeHtml(item.newspaper || item.type)}</span>
            <span class="archive-date-tag">${escapeHtml(item.date || (item.year ? String(item.year) : ""))}</span>
          </div>
          <div class="archive-type">${escapeHtml(item.category)}</div>
          <h3 class="archive-title">${escapeHtml(item.title)}</h3>
          ${
            item.location
              ? `<div class="archive-location-tag">📍 ${escapeHtml(item.location)}</div>`
              : ""
          }
          <p style="font-size:0.88rem;color:var(--ink-secondary);line-height:1.55;">
            ${escapeHtml(item.snippet)}
          </p>
          ${
            item.quote
              ? `<blockquote class="source-quote-box">„${escapeHtml(item.quote)}“</blockquote>`
              : ""
          }
          ${
            item.originalArchive
              ? `<div>
                  <a href="${item.archiveUrl || '#'}" target="_blank" rel="noopener" class="archive-origin-ref" title="Original-Digitalisat im Pressearchiv aufrufen">
                    🏛️ ${escapeHtml(item.originalArchive)} ↗
                  </a>
                </div>`
              : ""
          }
          ${
            personLinksHtml
              ? `<div class="archive-person-links">${personLinksHtml}</div>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    // Mehr-Laden Button
    const loadMoreContainer = document.getElementById("archive-load-more-container");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = archiveLimit < filtered.length ? "block" : "none";
    }

    // Klick auf Zeitungsausschnitt öffnet Lightbox
    grid.querySelectorAll(".archive-card-thumb-wrap").forEach((wrap) => {
      wrap.addEventListener("click", () => {
        const src = wrap.getAttribute("data-full-src");
        const cap = wrap.getAttribute("data-caption");
        if (src) openLightbox(src, cap);
      });
    });

    // Klick auf Personenlink öffnet Personen-Dossier
    grid.querySelectorAll(".archive-person-link").forEach((link) => {
      link.addEventListener("click", () => {
        const pid = link.getAttribute("data-person-id");
        if (pid) openPersonModal(pid);
      });
    });
  }

  function renderPhotosGrid() {
    const grid = document.getElementById("photos-grid");
    if (!grid || !DATA.photoAlbum) return;

    grid.innerHTML = DATA.photoAlbum
      .map((photo) => {
        const linkedPeopleHtml = (photo.personIds || [])
          .map((pid) => {
            const p = peopleById.get(pid);
            if (!p) return "";
            return `<span class="tag-badge photo-person-chip" data-person-id="${p.id}" style="cursor:pointer;">👤 ${p.displayName}</span>`;
          })
          .join(" ");

        return `
        <div class="gallery-card">
          <div class="gallery-img-wrap" data-full-src="${photo.src}" data-caption="${photo.title} (${photo.date}) – ${photo.caption}">
            <img src="${photo.src}" alt="${photo.title}" loading="lazy" />
          </div>
          <div class="gallery-caption">
            <div style="font-size:0.74rem;font-weight:700;color:var(--accent-gold);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem;">
              📅 ${photo.date} · 📍 ${photo.place || "Familienarchiv"}
            </div>
            <strong>${photo.title}</strong>
            <div style="margin-top:0.25rem;">${photo.caption}</div>
            ${
              linkedPeopleHtml
                ? `<div class="person-card-tags" style="margin-top:0.65rem;">${linkedPeopleHtml}</div>`
                : ""
            }
          </div>
        </div>
      `;
      })
      .join("");

    grid.querySelectorAll(".gallery-img-wrap").forEach((wrap) => {
      wrap.addEventListener("click", () => {
        const src = wrap.getAttribute("data-full-src");
        const caption = wrap.getAttribute("data-caption");
        if (src) openLightbox(src, caption);
      });
    });

    grid.querySelectorAll(".photo-person-chip").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = chip.getAttribute("data-person-id");
        if (pid) openPersonModal(pid);
      });
    });
  }

  function openLightbox(src, caption) {
    const backdrop = document.getElementById("lightbox-backdrop");
    const img = document.getElementById("lightbox-img");
    const cap = document.getElementById("lightbox-caption");
    if (!backdrop || !img) return;
    img.src = src;
    if (cap) cap.textContent = caption || "";
    backdrop.classList.add("open");
  }

  function closeLightbox() {
    const backdrop = document.getElementById("lightbox-backdrop");
    backdrop?.classList.remove("open");
  }

  // =========================================================================
  // PERSON DOSSIER MODAL (BIOGRAPHY, PHOTO SETUP, RELATIVES, SOURCES)
  // =========================================================================

  function openPersonModal(personId) {
    const person = peopleById.get(personId);
    if (!person) return;

    selectedPersonId = personId;
    renderTree();

    const backdrop = document.getElementById("person-modal-backdrop");
    const content = document.getElementById("person-modal-content");
    if (!backdrop || !content) return;

    const branch = branchesById.get(person.branchId);
    const photoUrl = getPersonPhoto(person.id);
    const rels = getRelatives(person.id);
    const extraArticles = customArticles[person.id] || [];
    const matchedArticles = ((window.KRUEGERMEYER_ZEITUNGEN || []).filter(
      (art) => art.personIds && art.personIds.includes(person.id)
    )).map((art) => ({
      type: art.category || "Historischer Zeitungsartikel",
      title: `${art.newspaper} (${art.date || art.year})`,
      detail: art.snippet || art.title,
      image: art.image,
      newspaper: art.newspaper,
      originalArchive: art.originalArchive,
      archiveUrl: art.archiveUrl,
      quote: null
    }));
    const allSources = [...(person.sources || []), ...matchedArticles, ...extraArticles];
    const galleryPhotos = person.gallery || [];
    const roleInfo = DIRECT_ANCESTOR_ROLES[person.id];

    // Build Relatives Cards HTML
    const relCards = [];
    rels.parents.forEach((par) => {
      relCards.push({
        role: par.gender === "female" ? "Mutter" : "Vater",
        person: par,
        sub: formatLifespan(par)
      });
    });
    rels.spouses.forEach((sp) => {
      relCards.push({
        role: sp.roleLabel
          ? sp.roleLabel
          : `Ehepartner/in ${sp.date ? `(⚭ ${sp.date})` : ""}`,
        person: sp.person,
        sub: sp.place || formatLifespan(sp.person)
      });
    });
    rels.siblings.forEach((sib) => {
      relCards.push({
        role: sib.gender === "female" ? "Schwester" : "Bruder",
        person: sib,
        sub: formatLifespan(sib)
      });
    });
    rels.children.forEach((ch) => {
      relCards.push({
        role: ch.gender === "female" ? "Tochter" : "Sohn",
        person: ch,
        sub: formatLifespan(ch)
      });
    });
    (rels.grandparents || []).forEach((gp) => {
      relCards.push({
        role: gp.gender === "female" ? "Großmutter" : "Großvater",
        person: gp,
        sub: formatLifespan(gp)
      });
    });
    (rels.unclesAunts || []).forEach((ua) => {
      relCards.push({
        role: ua.gender === "female" ? "Tante" : "Onkel",
        person: ua,
        sub: formatLifespan(ua)
      });
    });
    (rels.cousins || []).forEach((cous) => {
      relCards.push({
        role: cous.gender === "female" ? "Cousine" : "Cousin",
        person: cous,
        sub: formatLifespan(cous)
      });
    });
    (rels.nephewsNieces || []).forEach((nn) => {
      relCards.push({
        role: nn.gender === "female" ? "Nichte" : "Neffe",
        person: nn,
        sub: formatLifespan(nn)
      });
    });
    (rels.grandchildren || []).forEach((gc) => {
      relCards.push({
        role: gc.gender === "female" ? "Enkeltochter" : "Enkelsohn",
        person: gc,
        sub: formatLifespan(gc)
      });
    });

    content.innerHTML = `
      <div class="dossier-header">
        <div class="dossier-profile">
          <div class="dossier-photo-wrap">
            <div class="dossier-avatar" id="modal-avatar-preview">
              ${
                photoUrl
                  ? `<img src="${photoUrl}" alt="${person.displayName}" />`
                  : `<span class="node-initials">${getInitials(person)}</span>`
              }
            </div>
            <label class="btn-photo-upload">
              📷 Foto einrichten
              <input type="file" id="modal-photo-input" accept="image/*" style="display:none;" />
            </label>
          </div>
          <div class="dossier-title-group">
            <div class="dossier-branch-badge">
              <span>●</span> ${
                roleInfo ? `${roleInfo.label} · ` : ""
              }${branch ? branch.name : "Familienstammbaum"}
            </div>
            <h2 class="dossier-name">${person.displayName}</h2>
            <div class="dossier-Facts">
              <span>🗓️ ${formatLifespan(person)}</span>
              <span>📍 ${person.primaryLocation || "Ort dokumentiert"}</span>
              ${person.occupation ? `<span>💼 ${person.occupation}</span>` : ""}
            </div>
            <div class="person-card-tags" style="margin-top:0.4rem;">
              ${(person.tags || [])
                .map((t) => `<span class="tag-badge">${t}</span>`)
                .join("")}
            </div>
          </div>
        </div>
        <div class="dossier-header-actions">
          <button class="btn-control btn-sm" id="btn-locate-in-tree" title="Person im Stammbaum zentrieren">
            🌳 Im Baum zeigen
          </button>
          <button class="btn-control btn-sm" id="btn-print-dossier" title="Personen-Chronik drucken / als PDF speichern">
            🖨️ Drucken
          </button>
          <button class="btn-close-modal" id="btn-close-dossier" title="Schließen">✕</button>
        </div>
      </div>

      <div class="dossier-body">
        <!-- Ausformulierte Lebensgeschichte -->
        <section class="dossier-section">
          <div class="dossier-section-title">
            <span>📖 Ausgearbeitete Lebensgeschichte &amp; Chronik</span>
          </div>
          <div class="biography-prose">${person.biography}</div>
        </section>

        ${
          galleryPhotos.length > 0
            ? `
        <!-- Historische Originalfotos der Person -->
        <section class="dossier-section">
          <div class="dossier-section-title">
            <span>📸 Historische Originalfotos (${galleryPhotos.length})</span>
            <span style="font-size:0.76rem;font-weight:400;color:var(--ink-muted);">Klicken für Großansicht</span>
          </div>
          <div class="gallery-grid">
            ${galleryPhotos
              .map(
                (g) => `
              <div class="gallery-card modal-gallery-item" data-full-src="${g.src}" data-caption="${g.title} (${g.date || ""}) – ${g.caption || ""}">
                <div class="gallery-img-wrap">
                  <img src="${g.src}" alt="${g.title}" />
                </div>
                <div class="gallery-caption">
                  <strong>${g.title} ${g.date ? `(${g.date})` : ""}</strong>
                  <div>${g.caption || ""}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </section>
        `
            : ""
        }

        <!-- Familienverbindungen (Klickbar) -->
        <section class="dossier-section">
          <div class="dossier-section-title">
            <span>🌳 Direkte Familienverbindungen (${relCards.length})</span>
            <span style="font-size:0.76rem;font-weight:400;color:var(--ink-muted);">Klicken zum Wechseln</span>
          </div>
          ${
            relCards.length > 0
              ? `<div class="relatives-grid">
                  ${relCards
                    .map(
                      (r) => `
                    <div class="relative-card" data-rel-id="${r.person.id}">
                      <div class="relative-role">${r.role}</div>
                      <div class="relative-name">${r.person.displayName}</div>
                      <div class="relative-sub">${r.sub}</div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
              : `<p style="font-size:0.88rem;color:var(--ink-muted);">Für diese Person sind in den bisherigen Auszügen noch keine direkten Eltern- oder Kind-Einträge verknüpft. Sobald weitere Dokumente vorliegen, werden sie hier verbunden.</p>`
          }
        </section>

        <!-- Chronologische Lebensstationen -->
        <section class="dossier-section">
          <div class="dossier-section-title">
            <span>⏳ Dokumentierte Lebensstationen</span>
          </div>
          <div class="timeline-list">
            ${(person.events || [])
              .map(
                (ev) => `
              <div class="timeline-item">
                <div class="timeline-date">${ev.date}</div>
                <div class="timeline-title">${ev.title}</div>
                <div class="timeline-place">📍 ${ev.place}</div>
                <div class="timeline-desc">${ev.description}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </section>

        <!-- Zeitungsartikel, Urkunden & Historische Register -->
        <section class="dossier-section">
          <div class="dossier-section-title">
            <span>📰 Zeitungsartikel, Urkunden &amp; Quellenbelege (${allSources.length})</span>
            <button class="btn-control btn-sm" id="btn-toggle-article-form">
              + Zeitungsartikel / Erinnerung ergänzen
            </button>
          </div>
          <div class="source-list">
            ${allSources
              .map(
                (src) => `
              <div class="source-item ${src.image ? "with-image" : ""}">
                ${
                  src.image
                    ? `
                  <div class="source-item-thumb-box" data-lightbox-src="${src.image}" data-lightbox-cap="${escapeHtml(src.title + " – " + (src.newspaper || "Zeitungsarchiv"))}" title="Klicken für vergrößerten Zeitungsscan">
                    <img src="${src.image}" class="source-item-thumb" alt="${escapeHtml(src.title)}" loading="lazy" />
                    <div class="archive-card-zoom-hint">🔍 Klick</div>
                  </div>
                `
                    : ""
                }
                <div>
                  <div class="source-type-badge">${escapeHtml(src.type)}</div>
                  <div class="source-item-title">${escapeHtml(src.title)}</div>
                  <div class="source-item-detail">${escapeHtml(src.detail)}</div>
                  ${
                    src.quote
                      ? `<blockquote class="source-quote-box">„${escapeHtml(src.quote)}“</blockquote>`
                      : ""
                  }
                  ${
                    src.originalArchive
                      ? `<div style="margin-top:0.4rem;">
                          <a href="${src.archiveUrl || '#'}" target="_blank" rel="noopener" class="archive-origin-ref" title="Original-Digitalisat im Pressearchiv aufrufen">
                            🏛️ ${escapeHtml(src.originalArchive)} ↗
                          </a>
                        </div>`
                      : ""
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          <form class="add-article-form" id="form-add-article">
            <div style="font-weight:600;font-size:0.86rem;">Neuen Zeitungsartikel, Urkunde oder Familienerinnerung hinzufügen:</div>
            <input type="text" id="input-article-type" class="form-input" placeholder="Art (z.B. Zeitungsartikel, Urkunde, Anekdote)" value="Familienerinnerung / Zeitungsartikel" required />
            <input type="text" id="input-article-title" class="form-input" placeholder="Überschrift / Datum / Zeitung" required />
            <textarea id="input-article-detail" class="form-textarea" placeholder="Ausgearbeiteter Text oder Inhalt des Artikels..." required></textarea>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
              <button type="submit" class="btn-control" style="background:var(--ink-primary);color:#fff;">Speichern</button>
            </div>
          </form>
        </section>
      </div>
    `;

    backdrop.classList.add("open");

    // Bind header action buttons
    document.getElementById("btn-close-dossier")?.addEventListener("click", closePersonModal);
    document.getElementById("btn-print-dossier")?.addEventListener("click", () => {
      window.print();
    });
    document.getElementById("btn-locate-in-tree")?.addEventListener("click", () => {
      closePersonModal();
      switchView("tree");
      focusPersonInTree(person.id);
    });

    // Bind clicking on modal gallery items to open lightbox
    content.querySelectorAll(".modal-gallery-item").forEach((item) => {
      item.addEventListener("click", () => {
        const src = item.getAttribute("data-full-src");
        const caption = item.getAttribute("data-caption");
        if (src) openLightbox(src, caption);
      });
    });

    // Bind clicking on source item thumbnail to open lightbox
    content.querySelectorAll(".source-item-thumb-box").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const src = thumb.getAttribute("data-lightbox-src");
        const caption = thumb.getAttribute("data-lightbox-cap");
        if (src) openLightbox(src, caption);
      });
    });

    // Bind clicking on relative cards
    content.querySelectorAll(".relative-card").forEach((card) => {
      card.addEventListener("click", () => {
        const targetId = card.getAttribute("data-rel-id");
        if (targetId) openPersonModal(targetId);
      });
    });

    // Bind Photo Upload
    const photoInput = document.getElementById("modal-photo-input");
    photoInput?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        customPhotos[person.id] = dataUrl;
        try {
          localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(customPhotos));
        } catch (err) {
          console.warn("Foto zu groß für LocalStorage, bleibt für die Sitzung aktiv.");
        }
        openPersonModal(person.id);
        renderTree();
        renderPeopleGrid();
      };
      reader.readAsDataURL(file);
    });

    // Bind adding custom newspaper article
    const toggleBtn = document.getElementById("btn-toggle-article-form");
    const formEl = document.getElementById("form-add-article");
    toggleBtn?.addEventListener("click", () => {
      formEl?.classList.toggle("open");
    });

    formEl?.addEventListener("submit", (e) => {
      e.preventDefault();
      const type = document.getElementById("input-article-type").value.trim();
      const title = document.getElementById("input-article-title").value.trim();
      const detail = document.getElementById("input-article-detail").value.trim();
      if (!title || !detail) return;

      if (!customArticles[person.id]) customArticles[person.id] = [];
      customArticles[person.id].push({ type, title, detail });
      try {
        localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(customArticles));
      } catch (err) {
        console.warn(err);
      }
      openPersonModal(person.id);
      renderArchiveGrid();
    });
  }

  function closePersonModal() {
    const backdrop = document.getElementById("person-modal-backdrop");
    backdrop?.classList.remove("open");
  }

  // =========================================================================
  // BACKUP EXPORT & IMPORT FOR CUSTOM PHOTOS & NOTES
  // =========================================================================

  function initBackupControls() {
    document.getElementById("btn-export-data")?.addEventListener("click", () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        family: "Krügermeyer",
        customPhotos,
        customArticles
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kruegermeyer-familienarchiv-backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    document.getElementById("input-import-data")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (parsed.customPhotos) {
            customPhotos = { ...customPhotos, ...parsed.customPhotos };
            localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(customPhotos));
          }
          if (parsed.customArticles) {
            customArticles = { ...customArticles, ...parsed.customArticles };
            localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(customArticles));
          }
          renderTree();
          renderPeopleGrid();
          renderArchiveGrid();
        } catch (err) {
          console.error("Backup-Datei konnte nicht gelesen werden:", err);
        }
      };
      reader.readAsText(file);
    });
  }

  // =========================================================================
  // NAVIGATION & SEARCH INIT
  // =========================================================================

  function switchView(viewName) {
    activeView = viewName;
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-view") === viewName);
    });
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });
    if (viewName === "tree") {
      renderTree();
    }
  }

  function init() {
    // Populate Hero & Nav Stats
    const statPeople = document.getElementById("stat-people-count");
    const navPeople = document.getElementById("nav-people-count");
    if (statPeople) statPeople.textContent = DATA.people.length;
    if (navPeople) navPeople.textContent = DATA.people.length;

    // Navigation Tabs
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const v = tab.getAttribute("data-view");
        if (v) switchView(v);
      });
    });

    // Brand Home Link & Hero Quick Action Buttons
    document.getElementById("brand-home-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      activeBranchFilter = "bremen";
      renderBranchFilters();
      renderActiveBranchBanner();
      switchView("tree");
      fitTreeToViewport();
    });

    document.getElementById("btn-hero-direct-line")?.addEventListener("click", () => {
      activeBranchFilter = "bremen";
      renderBranchFilters();
      renderActiveBranchBanner();
      switchView("tree");
      fitTreeToViewport();
    });

    document.getElementById("btn-hero-open-chronicle")?.addEventListener("click", () => {
      switchView("chronicle");
    });

    document.getElementById("btn-hero-open-photos")?.addEventListener("click", () => {
      switchView("photos");
    });

    // Global Search
    const searchInput = document.getElementById("global-search-input");
    searchInput?.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      if (searchQuery && activeBranchFilter !== "all") {
        // Search across all branches automatically when typing a search query
        activeBranchFilter = "all";
        renderBranchFilters();
        renderActiveBranchBanner();
      }
      renderTree();
      renderPeopleGrid();
    });

    // Close modal on backdrop click or Escape key
    const modalBackdrop = document.getElementById("person-modal-backdrop");
    modalBackdrop?.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closePersonModal();
    });

    const lightboxBackdrop = document.getElementById("lightbox-backdrop");
    lightboxBackdrop?.addEventListener("click", (e) => {
      if (e.target === lightboxBackdrop) closeLightbox();
    });
    document.getElementById("btn-close-lightbox")?.addEventListener("click", closeLightbox);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeLightbox();
        closePersonModal();
      }
    });

    // Initial Render
    renderLineageStepper();
    renderBranchFilters();
    renderActiveBranchBanner();
    renderTree();
    renderChronicleView();
    renderPeopleGrid();
    renderPlacesGrid();
    renderArchiveGrid();
    renderPhotosGrid();
    initTreeViewportInteractions();
    initBackupControls();

    // Auto-fit direct line into the viewport on load
    setTimeout(() => fitTreeToViewport(), 40);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
