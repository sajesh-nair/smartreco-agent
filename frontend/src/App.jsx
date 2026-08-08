import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [courses, setCourses] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [telemetry, setTelemetry] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substring(2, 9));

  // --- Auth & Role State ---
  const [currentUser, setCurrentUser] = useState({ email: 'user@example.com', role: 'user', token: null });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('user');

  // --- Admin Modal State ---
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    id: '',
    title: '',
    category: 'Agentic AI',
    level: 'Intermediate',
    price: 3999,
    description: '',
    tags: ['Agent', 'AI']
  });

  useEffect(() => {
    fetchCourses();
    trackEvent('Session_Init', 'platform', { referrer: 'direct', user_role: currentUser.role });
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses`);
      setCourses(res.data);
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    }
  };

  const trackEvent = (eventType, targetId, metadata = {}) => {
    const payload = {
      session_id: sessionId,
      event_type: eventType,
      target_id: targetId,
      metadata: { ...metadata, user_role: currentUser.role, email: currentUser.email }
    };

    setTelemetry((prev) => [{ ...payload, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 19)]);

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE}/track`, blob);
    } else {
      axios.post(`${API_BASE}/track`, payload).catch(() => {});
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
      setCurrentUser({
        email: res.data.email,
        role: res.data.role,
        token: res.data.access_token
      });
      setShowLoginModal(false);
      trackEvent('User_Login', res.data.email, { role: res.data.role });
    } catch (err) {
      alert('Login failed. Please check credentials.');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/admin/product`, newProduct);
      alert('Product created via Dual-Write (SQL DB + ChromaDB)!');
      setShowAdminModal(false);
      fetchCourses();
      trackEvent('Admin_Product_Created', newProduct.id, { title: newProduct.title });
    } catch (err) {
      alert('Failed to create product. Make sure backend is running.');
    }
  };

  const triggerAgent = async (courseId = null) => {
    setLoadingAgent(true);
    try {
      const res = await axios.post(`${API_BASE}/recommend`, {
        session_id: sessionId,
        current_course_id: courseId,
        force_refresh: true
      });
      setRecommendation(res.data);
    } catch (err) {
      console.error('Recommendation engine failed:', err);
    } finally {
      setLoadingAgent(false);
    }
  };

  const categories = ['All', 'Agentic AI', 'Generative AI', 'MLOps', 'Data Engineering', 'Cloud & DevOps'];

  const filteredCourses = courses.filter((c) => {
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={styles.appContainer}>
      {/* --- Top Navigation Header --- */}
      <header style={styles.navbar}>
        <div style={styles.brandGroup}>
          <h1 style={styles.logoTitle}>⚡ SmartReco</h1>
          <span style={styles.badge}>MESH API AGENTIC ENGINE</span>
        </div>

        <input
          type="text"
          placeholder="Search catalog, vector topics, agentic tools..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length > 2) {
              trackEvent('Catalog_Search', e.target.value);
            }
          }}
          style={styles.searchInput}
        />

        <div style={styles.headerControls}>
          {/* Auth & Role Switcher */}
          <button style={styles.authBtn} onClick={() => setShowLoginModal(true)}>
            👤 {currentUser.email} ({currentUser.role.toUpperCase()})
          </button>

          {/* Admin Dual-Write Action Button */}
          {currentUser.role === 'admin' && (
            <button style={styles.adminBtn} onClick={() => setShowAdminModal(true)}>
              ➕ Admin: Add Product (Dual-Write)
            </button>
          )}

          <button style={styles.agentTriggerBtn} onClick={() => triggerAgent()} disabled={loadingAgent}>
            {loadingAgent ? 'Reasoning...' : '✨ Trigger Agent'}
          </button>
        </div>
      </header>

      {/* --- Main Dashboard Body --- */}
      <div style={styles.mainLayout}>
        {/* Left: Product Catalog */}
        <section style={styles.catalogSection}>
          <div style={styles.categoryBar}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  trackEvent('Category_Filter_Selected', cat);
                }}
                style={{
                  ...styles.categoryPill,
                  backgroundColor: selectedCategory === cat ? '#6366f1' : '#1e293b',
                  color: selectedCategory === cat ? '#fff' : '#94a3b8'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={styles.cardGrid}>
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                style={styles.courseCard}
                onMouseEnter={() => trackEvent('Card_Dwell_Hover', course.title)}
                onClick={() => {
                  trackEvent('Course_Selected', course.title, { price: course.price });
                  triggerAgent(course.id);
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.cardCategory}>{course.category}</span>
                  <span style={styles.cardLevel}>{course.level}</span>
                </div>
                <h3 style={styles.cardTitle}>{course.title}</h3>
                <p style={styles.cardDesc}>{course.description}</p>
                <div style={styles.tagGroup}>
                  {(course.tags || []).map((t, idx) => (
                    <span key={idx} style={styles.tag}>#{t}</span>
                  ))}
                </div>
                <div style={styles.cardFooter}>
                  <span style={styles.rating}>★ {course.rating || '4.8'}</span>
                  <span style={styles.price}>₹{course.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Agent Recommendation & Real-Time Telemetry Stream */}
        <aside style={styles.sidebar}>
          {/* Agent Pitch Box */}
          <div style={styles.agentBox}>
            <div style={styles.agentHeader}>
              <span style={styles.agentLabel}>🤖 AGENT RECOMMENDATION</span>
              <span style={styles.meshBadge}>MESH API</span>
            </div>
            <p style={styles.agentPitch}>
              {recommendation ? recommendation.persuasive_story : 'Select courses or filters to build session telemetry signals for Mesh API reasoning.'}
            </p>
          </div>

          {/* Inferred User Intent */}
          <div style={styles.intentBox}>
            <span style={styles.intentLabel}>🎯 Inferred User Intent</span>
            <p style={styles.intentText}>{recommendation ? recommendation.inferred_intent : 'Awaiting behavioral activity...'}</p>
          </div>

          {/* Micro-Interaction Telemetry Stream */}
          <div style={styles.telemetryBox}>
            <div style={styles.telemetryHeader}>
              <span>⚡ Telemetry Stream ({telemetry.length})</span>
              <span style={{ color: '#22c55e', fontSize: '12px' }}>● live</span>
            </div>
            <div style={styles.telemetryLog}>
              {telemetry.map((t, i) => (
                <div key={i} style={styles.telemetryItem}>
                  <span style={styles.telemetryType}>{t.event_type}</span>
                  <span style={styles.telemetryTarget}>{t.target_id}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* --- Login / Role Modal --- */}
      {showLoginModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Sign In & Choose Role</h3>
            <form onSubmit={handleLogin} style={styles.modalForm}>
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
                <option value="user">Regular User (Browses & Receives Recommendations)</option>
                <option value="admin">Admin User (Manages Catalog & Dual-Write DB)</option>
              </select>
              <div style={styles.modalActions}>
                <button type="submit" style={styles.submitBtn}>Sign In</button>
                <button type="button" onClick={() => setShowLoginModal(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Admin Add Product Modal (Dual-Write) --- */}
      {showAdminModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Admin: Add Product (Dual-Write to SQL + Vector DB)</h3>
            <form onSubmit={handleAddProduct} style={styles.modalForm}>
              <input
                type="text"
                placeholder="Product ID (e.g. course-rag-pro)"
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
                placeholder="Description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                required
                style={{ ...styles.modalInput, height: '80px' }}
              />
              <div style={styles.modalActions}>
                <button type="submit" style={styles.submitBtn}>Sync Dual-Write DB</button>
                <button type="button" onClick={() => setShowAdminModal(false)} style={styles.cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline CSS Styles for Modern UI
const styles = {
  appContainer: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  navbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  brandGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoTitle: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#38bdf8' },
  badge: { fontSize: '10px', backgroundColor: '#312e81', color: '#818cf8', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' },
  searchInput: { backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px 16px', borderRadius: '6px', width: '320px' },
  headerControls: { display: 'flex', gap: '12px', alignItems: 'center' },
  authBtn: { backgroundColor: '#334155', border: 'none', color: '#f8fafc', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  adminBtn: { backgroundColor: '#059669', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  agentTriggerBtn: { backgroundColor: '#4f46e5', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  mainLayout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', padding: '24px 32px' },
  catalogSection: { display: 'flex', flexDirection: 'column', gap: '20px' },
  categoryBar: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  categoryPill: { border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
  courseCard: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#818cf8', marginBottom: '8px' },
  cardCategory: { fontWeight: 'bold', textTransform: 'uppercase' },
  cardLevel: { color: '#94a3b8' },
  cardTitle: { fontSize: '16px', margin: '0 0 8px 0', color: '#f8fafc' },
  cardDesc: { fontSize: '13px', color: '#94a3b8', lineHeight: '1.4', height: '54px', overflow: 'hidden' },
  tagGroup: { display: 'flex', gap: '6px', margin: '12px 0' },
  tag: { fontSize: '10px', backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' },
  rating: { color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' },
  price: { fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '16px' },
  agentBox: { backgroundColor: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '12px', padding: '16px' },
  agentHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  agentLabel: { fontSize: '11px', color: '#818cf8', fontWeight: 'bold' },
  meshBadge: { fontSize: '10px', backgroundColor: '#312e81', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px' },
  agentPitch: { fontSize: '13px', lineHeight: '1.5', color: '#e0e7ff', margin: 0 },
  intentBox: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px' },
  intentLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' },
  intentText: { fontSize: '12px', color: '#38bdf8', marginTop: '6px', margin: 0 },
  telemetryBox: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '14px' },
  telemetryHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' },
  telemetryLog: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' },
  telemetryItem: { display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' },
  telemetryType: { color: '#38bdf8', fontWeight: 'bold' },
  telemetryTarget: { color: '#94a3b8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#1e293b', padding: '28px', borderRadius: '12px', width: '400px', border: '1px solid #334155' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  modalInput: { backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '6px' },
  modalActions: { display: 'flex', gap: '10px', marginTop: '8px' },
  submitBtn: { flex: 1, backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { backgroundColor: '#334155', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }
};