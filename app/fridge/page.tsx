import { readFileSync } from 'fs'
import { join } from 'path'

export default function FridgePage() { return null }

export async function getServerSideProps({ res }: any) {
  const htmlPath = join(process.cwd(), 'public', 'index.html')
  let html = readFileSync(htmlPath, 'utf8')
  html = html
    .replace('__FIREBASE_API_KEY__', process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '')
    .replace('__FIREBASE_AUTH_DOMAIN__', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '')
    .replace('__FIREBASE_PROJECT_ID__', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '')
    .replace('__FIREBASE_STORAGE_BUCKET__', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '')
    .replace('__FIREBASE_MESSAGING_SENDER_ID__', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '')
    .replace('__FIREBASE_APP_ID__', process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '')
  res.setHeader('Content-Type', 'text/html')
  res.write(html); res.end()
  return { props: {} }
}
