import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  Search, Sparkles, ShoppingCart, Check, 
  Activity, ArrowLeft, Bot, Zap, Cpu,
  Eye, PlusCircle, RefreshCw 
} from 'lucide-react';

// -----------------------------------------------------------------------------
// 1. Configuration & Session Management
// -----------------------------------------------------------------------------
const API_BASE = import.meta.env?.VITE_API_BASE_URL || '/api';

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return 'sess_default';
  
  let existing = localStorage.getItem('smartreco_session_id');
  if (!existing) {
    const uuid = window.crypto?.randomUUID ? window.crypto.randomUUID().replaceAll('-', '').substring(0, 10) : Math.random().toString(36).substring(2, 10);
    existing = `sess_${uuid}`;
    localStorage.setItem('smartreco_session_id', existing);
  }
  return existing;
};

const SESSION_ID = getOrCreateSessionId();
const CATEGORIES = ['All', 'Agentic AI', 'Generative AI', 'MLOps', 'Data Engineering', 'Cloud & DevOps'];

// -----------------------------------------------------------------------------
// 2. Hoisted Global Styles
// -----------------------------------------------------------------------------
const GlobalStyles = () => (
  <style>{`
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background-color: #06080d; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; overflow-x: hidden; }
    
    .elite-container { width: 100%; min-height: 100vh; padding: 20px 40px; background-color: #06080d; margin: 0 auto; max-width: 1600px; }

    /* Top Navigation Bar */
    .top-navbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; border-bottom: 1px solid #131927; width: 100%; }
    .nav-brand { font-size: 18px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 10px; letter-spacing: -0.3px; }
    .mesh-badge { background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%); color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; }

    .search-bar-wrap { position: relative; width: 440px; }
    .search-bar-input { width: 100%; padding: 9px 14px 9px 40px; background: #0c101b; border: 1px solid #1c2538; border-radius: 8px; color: #fff; font-size: 13px; outline: none; transition: border 0.2s; }
    .search-bar-input:focus { border-color: #6366f1; }

    .nav-right-tools { display: flex; align-items: center; gap: 12px; }
    .cart-trigger { background: #0c101b; border: 1px solid #1c2538; color: #cbd5e1; padding: 8px 14px; border-radius: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; transition: border 0.2s; }
    .cart-trigger:hover { border-color: #6366f1; }
    .cart-badge-count { background: #6366f1; color: #fff; font-size: 11px; font-weight: 800; border-radius: 10px; padding: 1px 7px; }

    .btn-mesh-console { background: #111728; border: 1px solid #3730a3; color: #c7d2fe; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; transition: all 0.2s; }
    .btn-mesh-console:hover { border-color: #6366f1; background: #1e1b4b; }
    .btn-mesh-console:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Grid Layout */
    .workspace-grid { display: grid; grid-template-columns: 1fr 390px; gap: 28px; width: 100%; margin-top: 22px; }

    .category-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .category-btn { background: #0c101b; border: 1px solid #1c2538; color: #94a3b8; padding: 7px 16px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: 500; transition: all 0.2s; }
    .category-btn.active, .category-btn:hover { background: #1e1b4b; border-color: #6366f1; color: #ffffff; font-weight: 700; }

    .catalog-3col { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; width: 100%; }
    
    .elite-card { background: #090d16; border: 1px solid #172033; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.25s ease; position: relative; }
    .elite-card:hover, .elite-card:focus { border-color: #6366f1; transform: translateY(-3px); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12); outline: none; }
    
    .card-top-tags { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .tag-category { background: #131b2e; border: 1px solid #283552; color: #818cf8; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    .tag-level { font-size: 11px; color: #64748b; font-weight: 500; }

    .card-heading { font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; line-height: 1.35; }
    .card-summary { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; height: 38px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

    .card-tech-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .tech-chip { background: #0f172a; border: 1px solid #1e293b; color: #94a3b8; font-size: 10px; padding: 2px 7px; border-radius: 4px; font-family: monospace; transition: all 0.15s; }
    .tech-chip:hover, .tech-chip:focus { border-color: #6366f1; color: #c7d2fe; outline: none; }

    .card-bottom-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #131a29; padding-top: 12px; font-size: 12px; }
    .card-price-tag { font-size: 15px; font-weight: 800; color: #ffffff; }

    /* Right Telemetry Drawer */
    .right-telemetry-drawer { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 20px; }

    .agent-output-card { background: linear-gradient(180deg, #0e0c24 0%, #080b12 100%); border: 1px solid #3730a3; border-radius: 12px; padding: 18px; box-shadow: 0 6px 20px rgba(99, 102, 241, 0.12); }
    .agent-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #818cf8; letter-spacing: 0.5px; margin-bottom: 10px; }
    .agent-speech-box { font-size: 13px; color: #e2e8f0; line-height: 1.55; font-weight: 500; background: #06080e; padding: 12px; border-radius: 8px; border: 1px solid #1f273d; }

    .intent-signal-box { background: #080c15; border: 1px solid #161e2e; border-radius: 12px; padding: 16px; }
    .telemetry-log-box { background: #080c15; border: 1px solid #161e2e; border-radius: 12px; padding: 16px; }

    .log-entry-row { background: #0d1322; border: 1px solid #1b2438; color: #a5b4fc; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-family: monospace; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }

    /* Course Detail View */
    .detail-curriculum-row { background: #080c15; border: 1px solid #161e2e; border-radius: 8px; padding: 14px 18px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
    .detail-curriculum-row:hover, .detail-curriculum-row:focus { border-color: #6366f1; background: #0d1322; outline: none; }
    .detail-curriculum-row.active-module { border-color: #6366f1; background: #131a2e; }
  `}</style>
);

export default function App() {
  const [courses, setCourses] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [agentPitch, setAgentPitch] = useState(
    "Monitoring session telemetry... Search topics, filter categories, or inspect modules to trigger real-time, LangGraph + Mesh API recommendations."
  );
  const [inferredIntent, setInferredIntent] = useState("Session live. Listening for micro-interactions...");
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [expandedCurriculum, setExpandedCurriculum] = useState(null);

  const hoverTimer = useRef(null);
  const searchDebounceTimer = useRef(null);
  const isMounted = useRef(true);

  const getItemTitle = useCallback((item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return item.title || item.name || '';
  }, []);

  // 1. Fetch Course Catalog
  const fetchCourses = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const res = await axios.get(`${API_BASE}/courses`, { timeout: 8000 });
      if (isMounted.current && Array.isArray(res.data)) {
        setCourses(res.data);
      }
    } catch (err) {
      console.error('[Catalog Service Error]:', err?.message || err);
    } finally {
      if (isMounted.current) setIsLoadingCatalog(false);
    }
  }, []);

  // 2. Invoke Agentic Recommendation Workflow
  const triggerAgentRecommendation = useCallback(async (force = false) => {
    if (!isMounted.current) return;
    setLoadingAgent(true);

    try {
      const res = await axios.post(
        `${API_BASE}/recommend`,
        {
          session_id: SESSION_ID,
          current_course_id: selectedCourse?.id || null,
          force_refresh: force
        },
        { timeout: 10000 }
      );

      if (isMounted.current && res.data) {
        if (res.data.persuasive_story) setAgentPitch(res.data.persuasive_story);
        if (res.data.inferred_intent) setInferredIntent(res.data.inferred_intent);
      }
    } catch (err) {
      console.error('[Agent Recommendation Error]:', err?.message || err);
    } finally {
      if (isMounted.current) setLoadingAgent(false);
    }
  }, [selectedCourse?.id]);

  // 3. Non-Blocking Telemetry Ingestion (Beacon API First)
  const logEvent = useCallback(async (eventType, targetId, metadata = {}) => {
    const payload = {
      session_id: SESSION_ID,
      event_type: eventType,
      target_id: String(targetId || 'unknown'),
      metadata: metadata || {}
    };

    setTelemetryLogs((prev) => [payload, ...prev.slice(0, 19)]);

    const endpoint = `${API_BASE}/track`;
    const blobPayload = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    // Enterprise Non-blocking Delivery: sendBeacon -> Axios Fallback
    let sent = false;
    if (navigator.sendBeacon) {
      sent = navigator.sendBeacon(endpoint, blobPayload);
    }

    if (!sent) {
      try {
        await axios.post(endpoint, payload, { timeout: 3000 });
      } catch (err) {
        console.warn('[Telemetry Fallback Failure]:', err?.message);
      }
    }

    // Trigger AI Agent update
    await triggerAgentRecommendation(false);
  }, [triggerAgentRecommendation]);

  useEffect(() => {
    isMounted.current = true;
    fetchCourses();
    logEvent('Session_Init', 'platform', { action: 'Platform Session Started', session_id: SESSION_ID });

    return () => {
      isMounted.current = false;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    };
  }, [fetchCourses, logEvent]);

  /* Interaction Handlers */
  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    logEvent('Category_Filter_Changed', cat, { category: cat });
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);

    if (val.trim().length > 2) {
      searchDebounceTimer.current = setTimeout(() => {
        logEvent('Search_Query_Entered', 'search_input', { query: val.trim() });
      }, 400);
    }
  };

  const handleTechBadgeClick = (e, tag) => {
    e.stopPropagation();
    logEvent('Tech_Badge_Clicked', tag, { tag });
  };

  const handleMouseEnter = (course) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      logEvent('Card_Dwell_Hover', course.id, { title: course.title, dwell: '1.2s hover' });
    }, 1200);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setExpandedCurriculum(null);
    logEvent('Course_Selected', course.id, { 
      title: course.title, 
      category: course.category, 
      price: course.price 
    });
  };

  const handleCurriculumInspect = (moduleItem) => {
    const modNum = typeof moduleItem === 'object' ? moduleItem.num : '1';
    const modTitle = getItemTitle(moduleItem);

    setExpandedCurriculum(modNum);
    logEvent('Curriculum_Module_Inspected', selectedCourse?.id || 'module', { 
      course: selectedCourse?.title || 'Unknown Course',
      module_num: modNum,
      module_title: modTitle
    });
  };

  const handleAddToCart = (e, course) => {
    if (e) e.stopPropagation();
    const target = course || selectedCourse;
    if (!target) return;

    if (!cartItems.some(item => item.id === target.id)) {
      setCartItems(prev => [...prev, target]);
    }
    logEvent('Cart_Item_Added', target.id, { title: target.title, price: target.price });
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (!c) return false;
      const cat = c.category || '';
      const title = c.title || '';
      const tags = Array.isArray(c.tags) ? c.tags : [];

      const matchesCat = activeCategory === 'All' || cat.toLowerCase().includes(activeCategory.toLowerCase());
      const matchesSearch = searchQuery.trim() === '' || 
                            title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCat && matchesSearch;
    });
  }, [courses, activeCategory, searchQuery]);

  return (
    <div className="elite-container">
      <GlobalStyles />

      {/* Navigation Header */}
      <header className="top-navbar" role="banner">
        <div className="nav-brand">
          <Zap size={20} color="#6366f1" aria-hidden="true" />
          <span>SmartReco</span>
          <span className="mesh-badge">MESH API AGENTIC ENGINE</span>
        </div>

        <div className="search-bar-wrap">
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '11px', color: '#475569' }} aria-hidden="true" />
          <input 
            type="search" 
            className="search-bar-input" 
            placeholder="Search catalog, vector topics, agentic tools..." 
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search course catalog"
          />
        </div>

        <div className="nav-right-tools">
          <button 
            className="cart-trigger"
            aria-label={`Shopping cart with ${cartItems.length} items`}
          >
            <ShoppingCart size={16} color="#94a3b8" aria-hidden="true" />
            <span>Cart</span>
            {cartItems.length > 0 && <span className="cart-badge-count">{cartItems.length}</span>}
          </button>

          <button 
            className="btn-mesh-console" 
            onClick={() => triggerAgentRecommendation(true)}
            disabled={loadingAgent}
            aria-live="polite"
          >
            {loadingAgent ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} aria-hidden="true" />}
            <span>{loadingAgent ? 'Mesh API Reasoning...' : 'Trigger Agent'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="workspace-grid">
        
        {/* LEFT CANVAS */}
        <section aria-label="Main Content Area">
          {!selectedCourse ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Product Catalog</h1>
                <span style={{ fontSize: '12px', color: '#64748b' }} aria-live="polite">
                  Showing {filteredCourses.length} production modules
                </span>
              </div>

              {/* Category Filter Pills */}
              <nav className="category-row" aria-label="Category Filters">
                {CATEGORIES.map((cat) => (
                  <button 
                    key={cat} 
                    className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(cat)}
                    aria-pressed={activeCategory === cat}
                  >
                    {cat}
                  </button>
                ))}
              </nav>

              {/* Catalog Grid */}
              <div className="catalog-3col" role="list">
                {isLoadingCatalog ? (
                  <div style={{ color: '#64748b', fontSize: '14px', gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center' }}>
                    Loading catalog from Mesh backend...
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '14px', gridColumn: '1 / -1', padding: '40px 0', textAlign: 'center' }}>
                    No courses match your criteria.
                  </div>
                ) : (
                  filteredCourses.map((course) => (
                    <div 
                      key={course.id} 
                      className="elite-card"
                      role="button"
                      tabIndex={0}
                      onMouseEnter={() => handleMouseEnter(course)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleSelectCourse(course)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectCourse(course)}
                      aria-label={`View details for ${course.title}`}
                    >
                      <div>
                        <div className="card-top-tags">
                          <span className="tag-category">{course.category}</span>
                          <span className="tag-level">{course.level}</span>
                        </div>

                        <h2 className="card-heading">{course.title}</h2>
                        <p className="card-summary">{course.description}</p>

                        <div className="card-tech-pills">
                          {course.tags?.map((tag, i) => (
                            <button 
                              key={i} 
                              className="tech-chip"
                              onClick={(e) => handleTechBadgeClick(e, tag)}
                              aria-label={`Filter by tag ${tag}`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="card-bottom-row">
                        <span style={{ color: '#fbbf24', fontWeight: '600' }} aria-label={`Rating ${course.rating || '4.8'} stars`}>
                          ★ {course.rating || '4.8'} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({course.students || '1.2k'})</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="card-price-tag">₹{course.price}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (

            /* COURSE DETAIL VIEW */
            <article>
              <button 
                onClick={() => setSelectedCourse(null)} 
                style={{ background: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
                aria-label="Back to Catalog"
              >
                <ArrowLeft size={15} aria-hidden="true" /> Back to Catalog
              </button>

              <div style={{ background: '#090d16', border: '1px solid #172033', borderRadius: '12px', padding: '28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <span className="tag-category">{selectedCourse.category}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedCourse.level}</span>
                </div>

                <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 12px 0', color: '#ffffff' }}>{selectedCourse.title}</h1>
                <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', maxWidth: '720px' }}>{selectedCourse.description}</p>
                
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '20px' }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#ffffff' }}>₹{selectedCourse.price}</span>
                  
                  <button 
                    onClick={(e) => handleAddToCart(e, selectedCourse)} 
                    style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#4f46e5'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#6366f1'}
                  >
                    <ShoppingCart size={15} aria-hidden="true" /> Add to Cart
                  </button>
                </div>
              </div>

              {/* CURRICULUM WITH MODULE INSPECTION TELEMETRY */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: 0 }}>Curriculum & Deep Observability</h2>
                <span style={{ fontSize: '11px', color: '#818cf8' }}>Click any module to stream granular signals</span>
              </div>

              <div role="list">
                {(selectedCourse.curriculum || []).map((item, idx) => {
                  const modNum = typeof item === 'object' ? item.num : idx + 1;
                  const modTitle = getItemTitle(item);
                  const isExpanded = expandedCurriculum === modNum;

                  return (
                    <div 
                      key={modNum} 
                      className={`detail-curriculum-row ${isExpanded ? 'active-module' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => handleCurriculumInspect(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCurriculumInspect(item)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1e1b4b', color: '#818cf8', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {modNum}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>{modTitle}</span>
                        </div>
                        <Eye size={16} color={isExpanded ? '#818cf8' : '#475569'} aria-hidden="true" />
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1e293b', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          [Agent Signal Streamed]: User inspecting Module #{modNum}: "{modTitle}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </section>

        {/* RIGHT TELEMETRY DRAWER */}
        <aside className="right-telemetry-drawer" aria-label="AI Telemetry and Recommendations">
          
          {/* MESH API Recommendation Card */}
          <div className="agent-output-card" aria-live="polite">
            <div className="agent-card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Bot size={15} color="#818cf8" aria-hidden="true" /> AGENT · RECOMMENDATION</span>
              <span style={{ fontSize: '10px', color: '#6366f1', background: '#1e1b4b', padding: '2px 6px', borderRadius: '4px' }}>MESH API</span>
            </div>
            <div className="agent-speech-box">
              {loadingAgent ? "Evaluating session telemetry via LangGraph agent..." : agentPitch}
            </div>
          </div>

          {/* Inferred Intent */}
          <div className="intent-signal-box">
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#a5b4fc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} aria-hidden="true" /> Inferred User Intent
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.45' }}>
              {inferredIntent}
            </div>
          </div>

          {/* Live Telemetry Stream Log */}
          <div className="telemetry-log-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} color="#818cf8" aria-hidden="true" /> Telemetry Stream ({telemetryLogs.length})
              </span>
              <span style={{ fontSize: '10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%' }}></span> live
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '240px', overflowY: 'auto' }} role="log" aria-live="polite">
              {telemetryLogs.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                  Awaiting user actions...
                </div>
              ) : (
                telemetryLogs.map((log, idx) => {
                  let displayLabel = log.target_id || 'System';
                  const meta = log.metadata || {};

                  if (meta.module_num) displayLabel = `Mod #${meta.module_num}`;
                  else if (meta.title) displayLabel = meta.title;
                  else if (meta.tag) displayLabel = `#${meta.tag}`;
                  else if (meta.category) displayLabel = meta.category;
                  else if (meta.query) displayLabel = `"${meta.query}"`;

                  return (
                    <div key={idx} className="log-entry-row">
                      <span style={{ fontWeight: '600' }}>{log.event_type}</span>
                      <span 
                        style={{ color: '#64748b', fontSize: '10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={displayLabel}
                      >
                        {displayLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </aside>

      </main>
    </div>
  );
}