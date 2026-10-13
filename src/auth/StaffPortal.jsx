import { useAuth } from './useAuth.js'
import { Icon } from '../components/Icon.jsx'

export default function StaffPortal() {
  const { profile, signOutUser } = useAuth()

  return (
    <main className="staff-portal">
      <header className="staff-topbar">
        <a className="auth-brand" href="/" aria-label="Payday home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>payday<span className="brand-period">.</span></span>
        </a>
        <button className="staff-signout" type="button" onClick={signOutUser}>Sign out</button>
      </header>
      <section className="staff-welcome">
        <span className="eyebrow">STAFF SELF-SERVICE</span>
        <h1>Hello, {profile.displayName.split(/\s+/)[0]}</h1>
        <p>Your personal space for work updates and pay information.</p>
      </section>
      <section className="staff-profile-card">
        <div className="staff-initials">{profile.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div className="staff-profile-info"><strong>{profile.displayName}</strong><span>{profile.jobTitle} · {profile.department}</span><small>{profile.email}</small></div>
        <span className="staff-account-status">Verified account</span>
      </section>
      <section className="staff-feature-grid">
        <article className="staff-feature">
          <span className="staff-feature-icon staff-feature-violet"><Icon name="wallet" size={20} /></span>
          <span className="eyebrow">PAY &amp; DOCUMENTS</span>
          <h2>Your payslips</h2>
          <p>Your payslips will appear here after your administrator runs payroll.</p>
          <span className="feature-coming">No payslips yet</span>
        </article>
        <article className="staff-feature">
          <span className="staff-feature-icon staff-feature-green"><Icon name="calendar" size={20} /></span>
          <span className="eyebrow">TIME AWAY</span>
          <h2>Leave requests</h2>
          <p>Request time off and keep track of your leave approval status here.</p>
          <span className="feature-coming">Leave requests coming next</span>
        </article>
        <article className="staff-feature">
          <span className="staff-feature-icon staff-feature-orange"><Icon name="bell" size={20} /></span>
          <span className="eyebrow">UPDATES</span>
          <h2>Tasks &amp; notifications</h2>
          <p>Important tasks and updates from your team will show up here.</p>
          <span className="feature-coming">You're all caught up</span>
        </article>
      </section>
      <footer className="staff-footer">Your account is secured with Firebase Authentication.</footer>
    </main>
  )
}
