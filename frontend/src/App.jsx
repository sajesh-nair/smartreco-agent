import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

// ============================================================================
// 1. Vector Icon Assets
// ============================================================================

const Icons = {
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  GraduationCap: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  PlusAdmin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Cart: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
};

// ============================================================================
// 2. Elite Aligned Header Component
// ============================================================================

const Navbar = ({ user, isAuthenticated, searchQuery, onSearchChange, onOpenAuth, onLogout, onOpenAdmin, cartCount }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (email) => {
    if (!email || email === 'Guest Visitor') return 'G';
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header style={styles.navbar}>
      <div style={styles.navbarInner}>
        {/* Brand Group */}
        <div style={styles.brandGroup}>
          <div style={styles.logoBadge}>
            <Icons.GraduationCap />
          </div>
          <div style={styles.brandTextGroup}>
            <span style={styles.brandTitle}>Aura Academy</span>
            <span style={styles.brandSubtitle}>AI LEARNING MARKETPLACE</span>
          </div>
        </div>

        {/* Centered Search Bar */}
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}><Icons.Search /></span>
          <input
            type="text"
            placeholder="Search courses, skill paths, instructors..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Right Action Group */}
        <div style={styles.navRightGroup}>
          {/* Cart Badge */}
          <div style={styles.cartBadgeBtn} title="Learning Cart">
            <Icons.Cart />
            <span style={styles.cartBadgeText}>{cartCount}</span>
          </div>

          {isAuthenticated && user.role === 'admin' && (
            <button style={styles.adminBtn} onClick={onOpenAdmin}>
              <Icons.PlusAdmin /> Add Course
            </button>
          )}

          <div style={{ position: 'relative' }} ref={menuRef}>
            {isAuthenticated ? (
              <button
                style={styles.avatarCircle}
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user.email}
              >
                {getInitials(user.email)}
              </button>
            ) : (
              <button style={styles.signInBtn} onClick={onOpenAuth}>
                Sign in
              </button>
            )}

            {showUserMenu && isAuthenticated && (
              <div style={styles.profileDropdown}>
                <div style={styles.dropdownUserRow}>
                  <div style={styles.dropdownAvatar}>{getInitials(user.email)}</div>
                  <div style={styles.dropdownTextGroup}>
                    <span style={styles.dropdownEmail}>{user.email}</span>
                    <span style={styles.dropdownRoleBadge}>
                      {(user.role || 'user').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={styles.dropdownDivider} />
                <button
                  style={styles.dropdownItem}
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAuth();
                  }}
                >
                  Switch Role / Account
                </button>
                <button
                  style={{ ...styles.dropdownItem, color: '#f87171' }}
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// ============================================================================
// 3. Course Card Component
// ============================================================================

const CourseCard = ({ course, onHover, onSelect, onAddToCart, isInCart }) => {
  const hoverTimer = useRef(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => {
      onHover(course.title);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <div
      style={styles.courseCard}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(course)}
    >
      <div style={styles.cardMetaHeader}>
        <span style={styles.categoryBadge}>{course.category}</span>
        <span style={styles.levelBadge}>{course.level || 'Advanced'}</span>
      </div>

      <h3 style={styles.cardTitle}>{course.title}</h3>
      <p style={styles.cardDesc}>{course.description}</p>

      <div style={styles.tagGroup}>
        {(course.tags || []).map((t, idx) => (
          <span key={idx} style={styles.tagPill}>#{t}</span>
        ))}
      </div>

      <div style={styles.cardFooter}>
        <div style={styles.ratingBox}>
          <Icons.Star />
          <span style={styles.ratingValue}>{course.rating || '4.9'}</span>
          <span style={styles.studentCount}>({course.students || '1.2k'})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.priceTag}>₹{course.price}</div>
          <button
            style={{
              ...styles.addToCartBtnCard,
              backgroundColor: isInCart ? 'rgba(34, 197, 94, 0.2)' : 'rgba(99, 102, 241, 0.15)',
              color: isInCart ? '#4ade80' : '#a5b4fc',
              borderColor: isInCart ? '#22c55e' : '#6366f1'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(course);
            }}
          >
            {isInCart ? 'Added' : '+ Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Main App Component
// ============================================================================

export default function App() {
  const [courses, setCourses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [telemetry, setTelemetry] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 9));

  // Cart & Modal State
  const [cart, setCart] = useState([]);
  const [selectedCourseModal, setSelectedCourseModal] = useState(null);

  // LOGGED OUT BY DEFAULT (Guest Mode)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    email: 'Guest Visitor',
    role: 'guest',
    token: null
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('user');

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    id: '',
    title: '',
    category: 'Agentic AI',
    level: 'Advanced',
    price: 4999,
    description: '',
    tags: ['Agentic', 'LangGraph']
  });

  useEffect(() => {
    fetchCatalog();
    trackEvent('Session_Init', 'platform_boot', { referrer: 'direct' });
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses`);
      setCourses(res.data);
    } catch (err) {
      console.error('Catalog fetch error:', err);
    }
  };

  const trackEvent = useCallback((eventType, targetId, metadata = {}) => {
    const payload = {
      session_id: sessionId,
      event_type: eventType,
      target_id: targetId,
      metadata: { ...metadata, user_role: currentUser.role, user_email: currentUser.email }
    };

    setTelemetry((prev) => [
      { ...payload, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 24)
    ]);

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE}/track`, blob);
    } else {
      axios.post(`${API_BASE}/track`, payload).catch(() => {});
    }
  }, [sessionId, currentUser]);

  const handleAddToCart = (course) => {
    if (!cart.some((item) => item.id === course.id)) {
      setCart((prev) => [...prev, course]);
      trackEvent('Added_To_Cart', course.title, { price: course.price });
      triggerAgent(course.id, course.category);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email: loginEmail,
        password: loginPassword,
        role: loginRole
      });
      setCurrentUser({ email: res.data.email, role: res.data.role, token: res.data.access_token });
      setIsAuthenticated(true);
      setShowAuthModal(false);
      trackEvent('User_Login_Success', res.data.email, { role: res.data.role });
    } catch (err) {
      setCurrentUser({ email: loginEmail, role: loginRole, token: 'session_token' });
      setIsAuthenticated(true);
      setShowAuthModal(false);
      trackEvent('User_Login_Success', loginEmail, { role: loginRole });
    }
  };

  const handleLogout = () => {
    trackEvent('User_Logout', currentUser.email);
    setIsAuthenticated(false);
    setCurrentUser({ email: 'Guest Visitor', role: 'guest', token: null });
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/admin/product`, newProduct);
      alert('Course added to Aura Academy catalog!');
      setShowAdminModal(false);
      fetchCatalog();
      trackEvent('Admin_Course_Created', newProduct.id, { title: newProduct.title });
    } catch (err) {
      alert('Error creating course.');
    }
  };

  const triggerAgent = async (courseId = null, category = null) => {
    setLoadingAgent(true);
    try {
      const res = await axios.post(`${API_BASE}/recommend`, {
        session_id: sessionId,
        current_course_id: courseId,
        category_filter: category || selectedCategory,
        force_refresh: true
      });
      setRecommendation(res.data);
    } catch (err) {
      console.error('Advisor execution error:', err);
    } finally {
      setLoadingAgent(false);
    }
  };

  const categories = ['All', 'Agentic AI', 'Generative AI', 'MLOps', 'Data Engineering', 'Cloud & DevOps'];

  const filteredCourses = courses.filter((c) => {
    const matchCategory = selectedCategory === 'All' || c.category === selectedCategory;
    const matchSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const cleanTelemetryStream = telemetry.filter(t => t.event_type !== 'Card_Dwell_Hover');

  return (
    <div style={styles.appShell}>
      <Navbar
        user={currentUser}
        isAuthenticated={isAuthenticated}
        searchQuery={searchQuery}
        cartCount={cart.length}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q.length > 2) trackEvent('Catalog_Search', q);
        }}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onOpenAdmin={() => setShowAdminModal(true)}
      />

      <main style={styles.mainContainer}>
        {/* Main Course Catalog */}
        <section style={styles.catalogColumn}>
          <div style={styles.categoryFilterRow}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  trackEvent('Category_Filter_Applied', cat);
                  triggerAgent(null, cat);
                }}
                style={{
                  ...styles.categoryPill,
                  backgroundColor: selectedCategory === cat ? 'rgba(99, 102, 241, 0.25)' : 'rgba(17, 24, 39, 0.6)',
                  color: selectedCategory === cat ? '#f8fafc' : '#94a3b8',
                  borderColor: selectedCategory === cat ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={styles.courseGrid}>
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isInCart={cart.some((i) => i.id === course.id)}
                onHover={(title) => trackEvent('Card_Dwell_Hover', title)}
                onSelect={(c) => {
                  trackEvent('Course_Selected', c.title, { price: c.price });
                  setSelectedCourseModal(c);
                  triggerAgent(c.id, c.category);
                }}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        </section>

        {/* AI Observatory Sidebar */}
        <aside style={styles.sidebarColumn}>
          {/* Personalized Advisor Recommendation */}
          <div style={styles.agentCard}>
            <div style={styles.agentCardHeader}>
              <div style={styles.agentTitleGroup}>
                <span style={styles.pulseDot} />
                <span style={styles.agentTitleText}>PERSONALIZED AI ADVISOR</span>
              </div>
            </div>
            <p style={styles.agentPitchText}>
              {recommendation ? recommendation.persuasive_story : 'Explore courses, add items to cart, or filter topics to trigger custom AI recommendations.'}
            </p>

            {/* Interactive Grounded Recommendation Mini Cards */}
            {recommendation && recommendation.grounded_matches && recommendation.grounded_matches.length > 0 && (
              <div style={styles.recoMatchesStack}>
                <span style={styles.recoSectionHeader}>RECOMMENDED NEXT STEPS:</span>
                {recommendation.grounded_matches.slice(0, 2).map((match, idx) => (
                  <div
                  key={idx}
                  style={styles.recoMatchCard}
                  onClick={() => {
                  setSelectedCourseModal(match);
                  trackEvent('Agent_Reco_Clicked', match.title || match.id);
                  }}
                >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={styles.recoMatchTitle}>{match.title || match.id}</span>
              <span style={styles.recoMatchBadge}>AI Match</span>
              </div>
              <span style={styles.recoMatchCategory}>{match.category || 'AI Engineering'}</span>
            </div>
                ))}
              </div>
            )}

            <button
              style={styles.triggerBtnFull}
              onClick={() => triggerAgent()}
              disabled={loadingAgent}
            >
              <Icons.Sparkles />
              <span>{loadingAgent ? 'Analyzing Learning Signals...' : 'Generate Personal AI Pitch'}</span>
            </button>
          </div>

          {/* Inferred Learning Intent */}
          <div style={styles.intentCard}>
            <span style={styles.sidebarSectionLabel}>CURRENT LEARNING FOCUS</span>
            <div style={styles.intentText}>
              {recommendation ? recommendation.inferred_intent : `Focused on ${selectedCategory} domain exploration.`}
            </div>
          </div>

          {/* Live Activity Stream */}
          <div style={styles.telemetryCard}>
            <div style={styles.telemetryHeader}>
              <span>Live Learning Activity ({cleanTelemetryStream.length})</span>
              <span style={styles.liveIndicator}>● Active</span>
            </div>
            <div style={styles.telemetryLogList}>
              {cleanTelemetryStream.map((item, idx) => (
                <div key={idx} style={styles.telemetryRow}>
                  <span style={styles.eventTypeTag}>{item.event_type}</span>
                  <span style={styles.eventTargetText}>{item.target_id}</span>
                  <span style={styles.eventTimeText}>{item.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Course Detail Modal */}
      {selectedCourseModal && (
        <div style={styles.modalOverlay} onClick={() => setSelectedCourseModal(null)}>
          <div style={styles.courseModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeaderRow}>
              <span style={styles.categoryBadge}>{selectedCourseModal.category}</span>
              <button style={styles.closeBtn} onClick={() => setSelectedCourseModal(null)}>✕</button>
            </div>
            <h2 style={styles.courseModalTitle}>{selectedCourseModal.title}</h2>
            <p style={styles.courseModalDesc}>{selectedCourseModal.description}</p>

            <div style={styles.topicsSection}>
              <h4 style={styles.sectionHeader}>Syllabus & Core Modules</h4>
              <ul style={styles.topicList}>
                <li><Icons.CheckCircle /> Enterprise Production-Grade Architecture</li>
                <li><Icons.CheckCircle /> Hands-on LangGraph State Machine Agents</li>
                <li><Icons.CheckCircle /> Vector DB Indexing & RAG Retrieval Pipelines</li>
                <li><Icons.CheckCircle /> Real-time Telemetry & Microservices Integration</li>
              </ul>
            </div>

            <div style={styles.modalFooterRow}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Tuition Fee</span>
                <div style={styles.priceTag}>₹{selectedCourseModal.price}</div>
              </div>
              <button
                style={{
                  ...styles.enrollBtn,
                  backgroundColor: cart.some((i) => i.id === selectedCourseModal.id) ? '#22c55e' : '#4f46e5'
                }}
                onClick={() => {
                  handleAddToCart(selectedCourseModal);
                  setSelectedCourseModal(null);
                }}
              >
                {cart.some((i) => i.id === selectedCourseModal.id) ? 'In Cart' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={styles.modalTitle}>Account Sign In</h3>
            <form onSubmit={handleLogin} style={styles.formStack}>
              <input
                type="email"
                placeholder="Email Address"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={styles.modalInput}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={styles.modalInput}
              />
              <select
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value)}
                style={styles.modalInput}
              >
                <option value="user">Student / Learner</option>
                <option value="admin">Platform Instructor / Admin</option>
              </select>
              <div style={styles.modalActions}>
                <button type="submit" style={styles.btnPrimaryFull}>Sign In</button>
                <button type="button" onClick={() => setShowAuthModal(false)} style={styles.btnCancel}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Add Course Modal */}
      {showAdminModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={styles.modalTitle}>Publish New Course</h3>
            <form onSubmit={handleCreateProduct} style={styles.formStack}>
              <input
                type="text"
                placeholder="Course ID (e.g. course-rag-pro)"
                value={newProduct.id}
                onChange={(e) => setNewProduct({ ...newProduct, id: e.target.value })}
                required
                style={styles.modalInput}
              />
              <input
                type="text"
                placeholder="Course Title"
                value={newProduct.title}
                onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                required
                style={styles.modalInput}
              />
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                style={styles.modalInput}
              >
                <option value="Agentic AI">Agentic AI</option>
                <option value="Generative AI">Generative AI</option>
                <option value="MLOps">MLOps</option>
                <option value="Data Engineering">Data Engineering</option>
              </select>
              <input
                type="number"
                placeholder="Price (INR)"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                required
                style={styles.modalInput}
              />
              <textarea
                placeholder="Course Description & Learning Outcomes"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                required
                style={{ ...styles.modalInput, height: '80px', resize: 'none' }}
              />
              <div style={styles.modalActions}>
                <button type="submit" style={styles.btnPrimaryFull}>Publish Course</button>
                <button type="button" onClick={() => setShowAdminModal(false)} style={styles.btnCancel}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. Perfectly Aligned Styling System
// ============================================================================

const styles = {
  appShell: {
    backgroundColor: '#0b0f17',
    backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.08), transparent 70%)',
    color: '#f8fafc',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
    WebkitFontSmoothing: 'antialiased'
  },
  navbar: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  navbarInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 36px',
    maxWidth: '1600px',
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  brandGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoBadge: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  brandTextGroup: { display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  brandTitle: { fontSize: '16px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 },
  brandSubtitle: { fontSize: '8.5px', fontWeight: '800', color: '#818cf8', letterSpacing: '0.08em', marginTop: '2px' },
  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: '14px', display: 'flex', alignItems: 'center' },
  searchInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f8fafc',
    padding: '8px 16px 8px 36px',
    borderRadius: '20px',
    width: '400px',
    fontSize: '13px',
    outline: 'none',
    transition: 'all 0.2s'
  },
  navRightGroup: { display: 'flex', alignItems: 'center', gap: '14px' },
  cartBadgeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    color: '#a5b4fc',
    padding: '7px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '700'
  },
  cartBadgeText: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    borderRadius: '10px',
    padding: '1px 6px',
    fontSize: '10px'
  },
  adminBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    border: '1px solid rgba(5, 150, 105, 0.3)',
    color: '#34d399',
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  signInBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    padding: '7px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  avatarCircle: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    color: '#e0e7ff',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileDropdown: {
    position: 'absolute',
    right: 0,
    top: '44px',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    width: '220px',
    padding: '12px',
    zIndex: 200,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  },
  dropdownUserRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  dropdownAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#4f46e5',
    color: '#fff',
    fontWeight: '700',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownTextGroup: { display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' },
  dropdownEmail: { fontSize: '11px', fontWeight: '600', color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dropdownRoleBadge: { fontSize: '8px', color: '#818cf8', backgroundColor: 'rgba(99, 102, 241, 0.2)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700', width: 'fit-content' },
  dropdownDivider: { height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '8px 0' },
  dropdownItem: {
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    textAlign: 'left',
    padding: '6px',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  mainContainer: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '28px', padding: '28px 36px', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' },
  catalogColumn: { display: 'flex', flexDirection: 'column', gap: '20px' },
  categoryFilterRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  categoryPill: {
    border: '1px solid',
    padding: '8px 18px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s'
  },
  courseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' },
  courseCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '22px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  cardMetaHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' },
  categoryBadge: { fontSize: '10px', color: '#818cf8', fontWeight: '800', letterSpacing: '0.04em' },
  levelBadge: { fontSize: '10px', color: '#64748b', fontWeight: '500' },
  cardTitle: { fontSize: '15px', fontWeight: '700', margin: '0 0 8px 0', color: '#f8fafc', lineHeight: '1.3' },
  cardDesc: { fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', height: '54px', overflow: 'hidden', margin: '0 0 14px 0' },
  tagGroup: { display: 'flex', gap: '6px', marginBottom: '16px' },
  tagPill: {
    fontSize: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#38bdf8',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' },
  ratingBox: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' },
  ratingValue: { fontWeight: '700', color: '#f8fafc' },
  studentCount: { color: '#64748b', fontSize: '11px' },
  priceTag: { fontSize: '15px', fontWeight: '700', color: '#38bdf8' },
  addToCartBtnCard: {
    border: '1px solid',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  sidebarColumn: { display: 'flex', flexDirection: 'column', gap: '18px' },
  agentCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '14px',
    padding: '20px'
  },
  agentCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  agentTitleGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  pulseDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e' },
  agentTitleText: { fontSize: '10px', fontWeight: '800', color: '#a5b4fc', letterSpacing: '0.06em' },
  agentPitchText: { fontSize: '12px', lineHeight: '1.6', color: '#e0e7ff', margin: '0 0 16px 0' },
  recoMatchesStack: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  recoSectionHeader: { fontSize: '9px', fontWeight: '800', color: '#818cf8', letterSpacing: '0.06em' },
  recoMatchCard: {
  backgroundColor: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(99, 102, 241, 0.25)',
  borderRadius: '10px',
  padding: '12px 14px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  textAlign: 'left', // Fixes centered text stretching
  transition: 'all 0.2s ease-in-out'
},
recoMatchTitle: { 
  fontSize: '12px', 
  fontWeight: '700', 
  color: '#f8fafc',
  lineHeight: '1.3'
},
recoMatchBadge: { 
  fontSize: '9px', 
  backgroundColor: 'rgba(34, 197, 94, 0.15)', 
  color: '#4ade80', 
  padding: '2px 6px', 
  borderRadius: '4px', 
  fontWeight: '700',
  whiteSpace: 'nowrap', // Prevents 'AI Match' from wrapping onto 2 lines
  alignSelf: 'flex-start'
},
recoMatchCategory: { 
  fontSize: '10px', 
  color: '#94a3b8', 
  fontWeight: '500'
},
  triggerBtnFull: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
  },
  intentCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '16px'
  },
  sidebarSectionLabel: { fontSize: '9px', color: '#64748b', fontWeight: '800', letterSpacing: '0.08em' },
  intentText: { fontSize: '12px', color: '#38bdf8', fontWeight: '600', marginTop: '6px' },
  telemetryCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '16px'
  },
  telemetryHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '12px', color: '#cbd5e1' },
  liveIndicator: { color: '#22c55e', fontSize: '10px', fontWeight: '700' },
  telemetryLogList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' },
  telemetryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 13, 20, 0.6)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '11px',
    border: '1px solid rgba(255, 255, 255, 0.04)'
  },
  eventTypeTag: { color: '#38bdf8', fontWeight: '600' },
  eventTargetText: { color: '#94a3b8', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  eventTimeText: { color: '#475569', fontSize: '10px' },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '32px',
    width: '400px'
  },
  courseModalBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '16px',
    padding: '28px',
    width: '520px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
  },
  modalHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' },
  courseModalTitle: { fontSize: '20px', fontWeight: '800', margin: '14px 0 8px 0', color: '#f8fafc' },
  courseModalDesc: { fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '20px' },
  topicsSection: { backgroundColor: 'rgba(10, 13, 20, 0.6)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid rgba(255, 255, 255, 0.05)' },
  sectionHeader: { fontSize: '12px', fontWeight: '700', color: '#818cf8', margin: '0 0 10px 0' },
  topicList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#e0e7ff' },
  modalFooterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px' },
  enrollBtn: { color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  modalTitle: { fontSize: '16px', fontWeight: '700', margin: '0 0 20px 0', color: '#f8fafc' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '14px' },
  modalInput: {
    backgroundColor: 'rgba(10, 13, 20, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#f8fafc',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    width: '100%',
    boxSizing: 'border-box'
  },
  modalActions: { display: 'flex', gap: '10px', marginTop: '10px' },
  btnPrimaryFull: { flex: 1, backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  btnCancel: { backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#f8fafc', border: 'none', padding: '12px 18px', borderRadius: '8px', cursor: 'pointer' }
};