import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './useAuth.js'

function authMessage(error) {
  const messages = {
    'auth/invalid-credential': 'That email and password combination was not recognized.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
    'auth/email-already-in-use': 'An account already exists for this email. Sign in or reset its password.',
    'auth/weak-password': 'Choose a password with at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a little while, then try again.',
    'auth/network-request-failed': 'A network error occurred. Check your connection and try again.',
    'permission-denied': 'That employee ID could not be linked to your account. Check the ID with your administrator.',
  }
  return messages[error?.code] || error?.message || 'Something went wrong. Please try again.'
}

function AuthFrame({ eyebrow, title, description, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="auth-brand" href="/" aria-label="Payday home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>payday<span className="brand-period">.</span></span>
        </a>
        <div className="auth-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
      <p className="auth-footer">Secure team access · Payroll figures stay private</p>
    </main>
  )
}

function AuthError({ children }) {
  if (!children) return null
  return <div className="auth-error" role="alert">{children}</div>
}

function AuthSubmit({ busy, children }) {
  return <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : children}</button>
}

export function FirebaseSetupPage() {
  return (
    <AuthFrame eyebrow="ONE-TIME PROJECT SETUP" title="Connect your Firebase project" description="This app uses Firebase Authentication and Firestore. Add your Firebase web-app settings to a local environment file to enable secure sign-in.">
      <div className="setup-instructions">
        <p>Copy <code>.env.example</code> to <code>.env.local</code>, then fill in these values from Firebase Console → Project settings → Your apps:</p>
        <ul>
          <li><code>VITE_FIREBASE_API_KEY</code></li>
          <li><code>VITE_FIREBASE_AUTH_DOMAIN</code></li>
          <li><code>VITE_FIREBASE_PROJECT_ID</code></li>
          <li><code>VITE_FIREBASE_APP_ID</code></li>
        </ul>
        <p>Enable Email/Password sign-in and create the Firestore database before inviting anyone.</p>
      </div>
      <div className="auth-help">Firebase web configuration identifies your project; it is not a server secret. Never put service-account credentials in this app.</div>
    </AuthFrame>
  )
}

export function LoginPage() {
  const { signIn, user, profile, profileError } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (signInError) {
      setError(authMessage(signInError))
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    if (!user.emailVerified) return <VerificationPage />
    if (profileError) return <AccountBlocked message={profileError} />
    if (profile) return <AccountRedirect />
  }

  return (
    <AuthFrame eyebrow="WELCOME BACK" title="Sign in to Payday" description="Use your administrator or staff account to continue.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError>{error}</AuthError>
        <label>Email address<input autoComplete="email" autoFocus required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.co.ke" /></label>
        <label>Password<input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
        <AuthSubmit busy={busy}>Sign in</AuthSubmit>
      </form>
      <div className="auth-switch">Have an employee ID? <Link to="/accept-invite">Register your staff account</Link></div>
    </AuthFrame>
  )
}

export function AcceptInvitePage() {
  const { registerStaff, user, profile, profileError } = useAuth()
  const [searchParams] = useSearchParams()
  const [employeeId, setEmployeeId] = useState(searchParams.get('employeeId') ?? '')
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await registerStaff(employeeId, email, password)
      setVerificationSent(true)
    } catch (registrationError) {
      setError(authMessage(registrationError))
    } finally {
      setBusy(false)
    }
  }

  if (user && !user.emailVerified) return <VerificationPage />
  if (user?.emailVerified && profile) return <AccountRedirect />
  if (user?.emailVerified && profileError) return <AccountBlocked message={profileError} />

  if (verificationSent) {
    return (
      <AuthFrame eyebrow="CHECK YOUR EMAIL" title="Verify your email" description={`We sent a verification link to ${email.trim().toLowerCase()}. Open that link, then return here and sign in.`}>
        <div className="auth-help">Your staff portal remains locked until your work email is verified.</div>
        <Link className="button button-primary auth-submit auth-link-button" to="/login">Continue to sign in</Link>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame eyebrow="STAFF REGISTRATION" title="Set up your staff account" description="Use the employee ID and work email provided by your administrator.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthError>{error}</AuthError>
        <label>Employee ID<input autoComplete="off" autoFocus required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee ID" /></label>
        <label>Work email<input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.co.ke" /></label>
        <label>Create password<input autoComplete="new-password" minLength="8" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
        <label>Confirm password<input autoComplete="new-password" required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>
        <AuthSubmit busy={busy}>Create staff account</AuthSubmit>
      </form>
      <div className="auth-switch">Already registered? <Link to="/login">Sign in</Link></div>
    </AuthFrame>
  )
}

export function VerificationPage() {
  const { user, refreshVerification, resendVerification, signOutUser } = useAuth()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleRefresh() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await refreshVerification()
      setMessage('Email verified. Loading your secure staff portal…')
    } catch (refreshError) {
      setError(authMessage(refreshError))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setError('')
    setMessage('')
    try {
      await resendVerification()
      setMessage('A new verification email has been sent.')
    } catch (resendError) {
      setError(authMessage(resendError))
    }
  }

  return (
    <AuthFrame eyebrow="EMAIL VERIFICATION" title="One last step" description={`Verify ${user?.email ?? 'your email address'} to activate your staff account.`}>
      <AuthError>{error}</AuthError>
      {message && <div className="auth-success" role="status">{message}</div>}
      <button className="button button-primary auth-submit" type="button" disabled={busy} onClick={handleRefresh}>{busy ? 'Checking…' : "I've verified my email"}</button>
      <button className="auth-text-button" type="button" onClick={handleResend}>Resend verification email</button>
      <button className="auth-text-button" type="button" onClick={signOutUser}>Sign out</button>
    </AuthFrame>
  )
}

function AccountRedirect() {
  const { profile } = useAuth()
  if (profile?.role === 'admin' || profile?.role === 'staff') return <Navigate to="/" replace />
  return <AccountBlocked message="Your account does not have an approved Payday role. Contact the administrator." />
}

function AccountBlocked({ message }) {
  const { signOutUser } = useAuth()
  return (
    <AuthFrame eyebrow="ACCOUNT ACCESS" title="We couldn't open your account" description={message}>
      <button className="button button-primary auth-submit" type="button" onClick={signOutUser}>Sign out</button>
    </AuthFrame>
  )
}
