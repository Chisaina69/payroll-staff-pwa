import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './auth-context.js'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from '../firebase.js'

function getEmailKey(email) {
  return email.trim().toLowerCase()
}

function profileLoadErrorMessage(error) {
  if (error?.code === 'unavailable') {
    return 'Payday could not reach Cloud Firestore. In Firebase Console, confirm that the project configured by VITE_FIREBASE_PROJECT_ID has a Cloud Firestore database with ID (default). If you just created it, wait a few minutes and reload the app.'
  }
  if (error?.code === 'permission-denied') {
    return 'Firestore denied access to this account. Check that the deployed rules match the users/employees collections and that this account has an authorized user document.'
  }
  return error instanceof Error ? error.message : 'Unable to load your account profile.'
}

async function loadProfile(user) {
  const userSnapshot = await getDoc(doc(db, 'users', user.uid))
  if (!userSnapshot.exists()) return null

  const account = userSnapshot.data()
  const role = typeof account.role === 'string' ? account.role.toLowerCase() : account.role
  if (role !== 'staff') return { ...account, role }

  if (typeof account.employeeId !== 'string' || !account.employeeId) {
    throw new Error('Your staff account is missing its employee ID. Contact your administrator.')
  }

  const employeeSnapshot = await getDoc(doc(db, 'employees', account.employeeId))
  if (!employeeSnapshot.exists()) {
    throw new Error('Your employee record could not be found. Contact your administrator.')
  }

  const employee = employeeSnapshot.data()
  if (
    typeof employee.email !== 'string'
    || getEmailKey(employee.email) !== getEmailKey(user.email ?? '')
  ) {
    throw new Error('This account email does not match the employee record. Contact your administrator.')
  }

  return {
    ...employee,
    ...account,
    role,
    displayName: employee.displayName ?? employee.name ?? user.displayName ?? user.email,
    jobTitle: employee.jobTitle ?? employee.role ?? '',
    department: employee.department ?? '',
    monthlySalary: employee.monthlySalary ?? employee.salary,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(firebaseConfigured)
  const [profileError, setProfileError] = useState('')
  const authEventId = useRef(0)

  useEffect(() => {
    if (!auth) return undefined

    return onAuthStateChanged(auth, async (nextUser) => {
      const eventId = ++authEventId.current
      setLoading(true)
      setUser(nextUser)
      setProfile(null)
      setProfileError('')

      try {
        if (nextUser) {
          const nextProfile = await loadProfile(nextUser)
          if (eventId === authEventId.current) setProfile(nextProfile)
        }
      } catch (error) {
        if (eventId === authEventId.current) {
          console.error('Unable to load the signed-in user profile:', error)
          setProfileError(profileLoadErrorMessage(error))
        }
      } finally {
        if (eventId === authEventId.current) setLoading(false)
      }
    })
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!auth) throw new Error('Firebase is not configured.')
    return signInWithEmailAndPassword(auth, getEmailKey(email), password)
  }, [])

  const registerStaff = useCallback(async (employeeId, email, password) => {
    if (!auth || !db) throw new Error('Firebase is not configured.')

    const normalizedEmail = getEmailKey(email)
    const normalizedEmployeeId = employeeId.trim()
    if (!normalizedEmployeeId) throw new Error('Enter the employee ID provided by your administrator.')

    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
    await setDoc(doc(db, 'users', credential.user.uid), {
      role: 'staff',
      employeeId: normalizedEmployeeId,
      email: normalizedEmail,
    })
    await sendEmailVerification(credential.user, {
      url: `${window.location.origin}/login`,
    })
  }, [])

  const signOutUser = useCallback(async () => {
    if (!auth) throw new Error('Firebase is not configured.')
    await signOut(auth)
  }, [])

  const refreshVerification = useCallback(async () => {
    if (!auth?.currentUser) return
    await reload(auth.currentUser)
    if (!auth.currentUser.emailVerified) {
      throw new Error('Firebase still shows this email as unverified. Open the verification link, then try again.')
    }
    await auth.currentUser.getIdToken(true)
    const nextProfile = await loadProfile(auth.currentUser)
    setUser(auth.currentUser)
    setProfile(nextProfile)
    setProfileError('')
  }, [])

  const resendVerification = useCallback(async () => {
    if (!auth?.currentUser) throw new Error('Sign in first to resend the verification email.')
    await sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}/login`,
    })
  }, [])

  const value = useMemo(() => ({
    configured: firebaseConfigured,
    user,
    profile,
    loading,
    profileError,
    signIn,
    registerStaff,
    signOutUser,
    refreshVerification,
    resendVerification,
  }), [user, profile, loading, profileError, signIn, registerStaff, signOutUser, refreshVerification, resendVerification])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
