import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase.js'

export async function createEmployeeRecord(employee, adminUid) {
  if (!db) throw new Error('Firebase is not configured.')

  const email = employee.email.trim().toLowerCase()
  const existingEmployees = await getDocs(
    query(collection(db, 'employees'), where('email', '==', email)),
  )
  if (!existingEmployees.empty) {
    throw new Error('An employee record already exists for this email.')
  }

  const employeeRef = await addDoc(collection(db, 'employees'), {
    displayName: employee.name.trim(),
    email,
    jobTitle: employee.role.trim(),
    department: employee.department,
    monthlySalary: Number(employee.salary),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  })

  return {
    employeeId: employeeRef.id,
    registrationUrl: `${window.location.origin}/accept-invite?employeeId=${encodeURIComponent(employeeRef.id)}`,
  }
}
