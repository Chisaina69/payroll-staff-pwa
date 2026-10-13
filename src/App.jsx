import { useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AcceptInvitePage, FirebaseSetupPage, LoginPage, VerificationPage } from './auth/AuthScreens.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { useAuth } from './auth/useAuth.js'
import StaffPortal from './auth/StaffPortal.jsx'
import { createEmployeeRecord } from './data/employees.js'
import { Icon } from './components/Icon.jsx'
import './App.css'

const initialEmployees = [
  { id: 1, name: 'Amara Wanjiku', role: 'Product Designer', department: 'Design', email: 'amara.w@company.co.ke', salary: 185000, status: 'Active', initials: 'AW', color: 'peach' },
  { id: 2, name: 'Brian Otieno', role: 'Frontend Developer', department: 'Engineering', email: 'brian.o@company.co.ke', salary: 240000, status: 'Active', initials: 'BO', color: 'blue' },
  { id: 3, name: 'Cynthia Njeri', role: 'People Operations', department: 'People', email: 'cynthia.n@company.co.ke', salary: 165000, status: 'On leave', initials: 'CN', color: 'purple' },
  { id: 4, name: 'David Kamau', role: 'Finance Lead', department: 'Finance', email: 'david.k@company.co.ke', salary: 280000, status: 'Active', initials: 'DK', color: 'green' },
  { id: 5, name: 'Eunice Achieng', role: 'Marketing Manager', department: 'Marketing', email: 'eunice.a@company.co.ke', salary: 210000, status: 'Active', initials: 'EA', color: 'yellow' },
]

const money = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
})

const navItems = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'people', label: 'People', icon: 'users' },
  { id: 'payroll', label: 'Payroll', icon: 'wallet', badge: '2' },
]

function Avatar({ employee, size = '' }) {
  return <span className={`avatar avatar-${employee.color} ${size}`}>{employee.initials}</span>
}

function EmployeeTable({ employees }) {
  if (employees.length === 0) {
    return <div className="empty-state">No team members match your search.</div>
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>TEAM MEMBER</th>
            <th>DEPARTMENT</th>
            <th>STATUS</th>
            <th>MONTHLY SALARY</th>
            <th aria-label="More actions" />
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <div className="person-cell">
                  <Avatar employee={employee} />
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.role}</span>
                  </div>
                </div>
              </td>
              <td><span className="department">{employee.department}</span></td>
              <td>
                <span className={`status status-${employee.status === 'Active' ? 'active' : 'leave'}`}>
                  <span className="status-dot" />
                  {employee.status}
                </span>
              </td>
              <td className="salary">{money.format(employee.salary)}</td>
              <td><button className="icon-button row-menu" type="button" aria-label={`More options for ${employee.name}`}>•••</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddEmployeeDialog({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [department, setDepartment] = useState('People')
  const [salary, setSalary] = useState('')
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const fullName = name.trim()
    if (!fullName || !email.trim() || !role.trim() || Number(salary) <= 0) return

    const [first = '', second = ''] = fullName.split(/\s+/)
    const id = Date.now()
    setError('')
    setBusy(true)
    try {
      const registration = await onAdd({
      id,
      name: fullName,
      email: email.trim(),
      role: role.trim(),
      department,
      salary: Number(salary),
      status: 'Active',
      initials: `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase(),
      color: ['peach', 'blue', 'purple', 'green', 'yellow'][id % 5],
      })
      setEmployeeId(registration.employeeId)
      setRegistrationUrl(registration.registrationUrl)
    } catch (employeeError) {
      setError(employeeError instanceof Error ? employeeError.message : 'The employee record could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function copyRegistrationLink() {
    try {
      await navigator.clipboard.writeText(registrationUrl)
      setCopied(true)
    } catch (copyError) {
      setError(copyError instanceof Error ? `Copy failed. Select and copy the registration link below. ${copyError.message}` : 'Copy failed. Select and copy the registration link below.')
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">YOUR TEAM</span>
            <h2 id="dialog-title">Add a team member</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        </div>
        {registrationUrl ? (
          <div className="invite-success">
              <div className="auth-success" role="status">Employee record created. Share the employee ID and registration link with the employee.</div>
            <label>
                Employee ID
                <input readOnly value={employeeId} onFocus={(event) => event.target.select()} />
            </label>
              <label>
                Staff registration link
                <input readOnly value={registrationUrl} onFocus={(event) => event.target.select()} />
              </label>
              <div className="dialog-actions">
                <button className="button button-quiet" type="button" onClick={onClose}>Done</button>
                <button className="button button-primary" type="button" onClick={copyRegistrationLink}>{copied ? 'Copied' : 'Copy registration link'}</button>
            </div>
          </div>
        ) : <form className="employee-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <label>
            Full name
            <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amina Hassan" />
          </label>
          <label>
            Work email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="amina@company.co.ke" />
          </label>
          <label>
            Job title
            <input required value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Operations Manager" />
          </label>
          <div className="form-row">
            <label>
              Department
              <select value={department} onChange={(event) => setDepartment(event.target.value)}>
                {['People', 'Engineering', 'Design', 'Finance', 'Marketing', 'Operations'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Monthly salary (KES)
              <input required min="1" type="number" value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="150000" />
            </label>
          </div>
          <p className="form-note">Creates the employee record used to register a staff account. The employee must use this work email and verify it before signing in.</p>
          <div className="dialog-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={busy}><Icon name="plus" size={16} /> {busy ? 'Creating record…' : 'Create employee record'}</button>
          </div>
        </form>}
      </section>
    </div>
  )
}

function AdminDashboard({ profile, onSignOut, onAdd }) {
  const [activePage, setActivePage] = useState('overview')
  const employees = initialEmployees
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [toast, setToast] = useState('')

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) =>
      [employee.name, employee.role, employee.department, employee.email, employee.status].some((value) => value.toLowerCase().includes(query)),
    )
  }, [employees, search])

  const payrollTotal = employees.reduce((total, employee) => total + employee.salary, 0)
  const firstName = profile.displayName.split(/\s+/)[0] || 'there'
  const pageTitle = activePage === 'people' ? 'Your people' : activePage === 'payroll' ? 'Payroll' : `Good morning, ${firstName}`

  async function createEmployee(employee) {
    return onAdd(employee)
  }

  function selectPage(page) {
    setActivePage(page)
    setSearch('')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => selectPage('overview')} aria-label="Payday home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>payday<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">S</span>
          <span className="workspace-copy"><strong>Studio North</strong><small>Workspace</small></span>
          <span className="switcher-chevron">⌄</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              className={`nav-item ${activePage === item.id ? 'nav-item-active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => selectPage(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <strong>Need a hand?</strong>
            <p>We're here to help you get paid right.</p>
            <button type="button" onClick={() => { setToast('Help centre is coming soon.'); window.setTimeout(() => setToast(''), 3200) }}>Visit help centre <span>↗</span></button>
          </div>
          <button className="nav-item settings-link" type="button" onClick={() => { setToast('Settings are coming soon.'); window.setTimeout(() => setToast(''), 3200) }}>
            <Icon name="settings" /><span>Settings</span>
          </button>
          <div className="profile">
            <span className="profile-avatar">{profile.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
            <span className="profile-copy"><strong>{profile.displayName}</strong><small>Administrator</small></span>
            <button className="profile-menu" type="button" onClick={onSignOut} aria-label="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage === 'overview' ? 'Overview' : activePage === 'people' ? 'People' : 'Payroll'}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input aria-label="Search team members" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) setActivePage('people') }} placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" type="button" aria-label="Notifications"><Icon name="bell" /><span /></button>
            <span className="topbar-avatar">{profile.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">{activePage === 'people' ? 'YOUR TEAM, AT A GLANCE' : activePage === 'payroll' ? 'PAYROLL OVERVIEW' : 'SAMPLE DASHBOARD PREVIEW'}</div>
              <h1>{pageTitle}<span className="heading-sparkle">{activePage === 'overview' ? ' ✳' : ''}</span></h1>
              <p>{activePage === 'people' ? 'A little team makes a big difference.' : activePage === 'payroll' ? 'Stay on top of every pay run, all in one place.' : "Here's what's happening with your team today."}</p>
            </div>
            <button className="button button-primary add-button" type="button" onClick={() => setShowDialog(true)}><Icon name="plus" size={17} /> Add team member</button>
          </section>

          <section className="demo-banner" aria-label="Sample dashboard notice">
            <strong>Sample dashboard</strong>
            <span>These example team members and payroll figures are not live Firebase records.</span>
          </section>

          {activePage === 'payroll' && (
            <section className="payroll-banner">
              <span className="banner-icon"><Icon name="calendar" size={21} /></span>
              <div><strong>October payroll is coming up</strong><p>Review your team's monthly salaries before the next pay run.</p></div>
              <span className="banner-amount">{money.format(payrollTotal)}<small>monthly gross</small></span>
            </section>
          )}

          <section className="summary-grid" aria-label="Payroll summary">
            <article className="summary-card">
              <div className="summary-top"><span>Total team members</span><span className="metric-icon metric-violet"><Icon name="users" size={17} /></span></div>
              <div className="metric-value">{employees.length.toString().padStart(2, '0')}<span className="metric-change">+2 this month</span></div>
              <div className="metric-caption">Across 5 departments</div>
            </article>
            <article className="summary-card">
              <div className="summary-top"><span>Monthly payroll</span><span className="metric-icon metric-green"><Icon name="wallet" size={17} /></span></div>
              <div className="metric-value metric-money">{money.format(payrollTotal)}</div>
              <div className="metric-caption">Gross monthly salaries <span className="caption-dot">·</span> KES</div>
            </article>
            <article className="summary-card">
              <div className="summary-top"><span>Next payday</span><span className="metric-icon metric-orange"><Icon name="calendar" size={17} /></span></div>
              <div className="metric-value">31 <span className="metric-unit">Oct</span></div>
              <div className="metric-caption"><span className="countdown-dot" /> 19 days to go</div>
            </article>
            <article className="summary-card">
              <div className="summary-top"><span>Needs your attention</span><span className="metric-icon metric-pink"><Icon name="clock" size={17} /></span></div>
              <div className="metric-value">03<span className="metric-change attention-change">items to review</span></div>
              <div className="metric-caption">Before the next pay run</div>
            </article>
          </section>

          {activePage !== 'people' && (
            <section className="overview-grid">
              <article className="panel payroll-panel">
                <div className="panel-heading">
                  <div><h2>Payroll overview</h2><p>Your monthly people spend</p></div>
                  <button className="select-button" type="button">Last 6 months <span>⌄</span></button>
                </div>
                <div className="chart-summary"><strong>{money.format(payrollTotal)}</strong><span className="trend-pill"><Icon name="arrow" size={13} /> 8.2%</span><span className="chart-period">vs. last month</span></div>
                <div className="chart" role="img" aria-label="Payroll costs from May to October are trending upward">
                  <div className="chart-guides"><span>{money.format(3000000)}</span><span>{money.format(2000000)}</span><span>{money.format(1000000)}</span><span>0</span></div>
                  <div className="chart-bars">
                    {[44, 57, 52, 72, 66, 87].map((height, index) => (
                      <div className="bar-column" key={index}>
                        <div className={`chart-bar ${index === 5 ? 'chart-bar-current' : ''}`} style={{ height: `${height}%` }}><span>{money.format(payrollTotal * (0.54 + index * 0.092))}</span></div>
                        <span className="bar-month">{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
              <article className="panel payday-panel">
                <div className="panel-heading">
                  <div><h2>Next payday</h2><p>October 2026 pay run</p></div>
                  <span className="calendar-badge"><Icon name="calendar" size={17} /></span>
                </div>
                <div className="payday-date"><strong>31</strong><span><b>Saturday</b><small>October 2026</small></span></div>
                <div className="payday-progress"><span /></div>
                <div className="payday-countdown"><span>Payroll preparation</span><strong>19 days left</strong></div>
                <div className="payday-note"><span className="note-check"><Icon name="check" size={14} /></span><span>You're right on track. Your payroll is looking good.</span></div>
                <button className="button button-outline full-button" type="button" onClick={() => selectPage('payroll')}>View payroll details <span>→</span></button>
              </article>
            </section>
          )}

          <section className="panel team-panel">
            <div className="panel-heading team-heading">
              <div><h2>{activePage === 'people' ? 'All team members' : 'Your team'}</h2><p>{search ? `${filteredEmployees.length} results for “${search}”` : 'Meet the people who make it happen.'}</p></div>
              {activePage !== 'people' && <button className="text-link" type="button" onClick={() => selectPage('people')}>View all <span>→</span></button>}
            </div>
            <div className="team-toolbar">
              <div className="team-tabs"><button className="team-tab team-tab-active" type="button">All members <span>{employees.length}</span></button><button className="team-tab" type="button" onClick={() => { setSearch('Active'); setActivePage('people') }}>Active</button></div>
              <button className="filter-button" type="button" onClick={() => { setToast('Department filters are coming soon.'); window.setTimeout(() => setToast(''), 3200) }}>☷ <span>Filter</span></button>
            </div>
            <EmployeeTable employees={filteredEmployees.slice(0, activePage === 'people' ? undefined : 5)} />
            <div className="table-footer"><span>Showing <strong>{filteredEmployees.length === 0 ? 0 : 1}–{Math.min(filteredEmployees.length, activePage === 'people' ? filteredEmployees.length : 5)}</strong> of <strong>{employees.length}</strong> team members</span><button className="text-link" type="button" onClick={() => selectPage('people')}>See all team members <span>→</span></button></div>
          </section>

          <footer className="page-footer"><span>Made for teams that care <span className="footer-heart">♥</span></span><span>Payroll figures shown are illustrative demo data.</span></footer>
        </div>
      </main>
      {showDialog && <AddEmployeeDialog onClose={() => setShowDialog(false)} onAdd={createEmployee} />}
      {toast && <div className="toast" role="status"><span className="toast-mark"><Icon name="check" size={15} /></span>{toast}</div>}
    </div>
  )
}

function AuthenticatedApp() {
  const { configured, user, profile, loading, profileError, signOutUser } = useAuth()

  if (!configured) return <FirebaseSetupPage />
  if (loading) return <main className="auth-loading">Loading your secure Payday session…</main>

  if (user && !user.emailVerified) return <VerificationPage />

  if (profileError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-heading"><span className="eyebrow">ACCOUNT ACCESS</span><h1>We couldn't open your account</h1><p>{profileError}</p></div>
          <button className="button button-primary auth-submit" type="button" onClick={signOutUser}>Sign out</button>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-heading"><span className="eyebrow">ACCOUNT ACCESS</span><h1>No portal assigned</h1><p>This account has no approved Payday role. Ask your administrator to confirm your employee ID and account setup.</p></div>
          <button className="button button-primary auth-submit" type="button" onClick={signOutUser}>Sign out</button>
        </section>
      </main>
    )
  }

  if (profile.role === 'admin') {
    return <AdminDashboard profile={profile} onSignOut={signOutUser} onAdd={(employee) => createEmployeeRecord(employee, user.uid)} />
  }

  if (profile.role === 'staff') return <StaffPortal />

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-heading"><span className="eyebrow">ACCOUNT ACCESS</span><h1>Unsupported account role</h1><p>Ask your administrator to check the role assigned to this account.</p></div>
        <button className="button button-primary auth-submit" type="button" onClick={signOutUser}>Sign out</button>
      </section>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

export default App
