import { Link } from 'react-router'

/** Shown when a URL names a pantry this browser does not have. */
export function PantryNotFound() {
  return (
    <section className="workspace">
      <h1>Pantry not found</h1>
      <p className="hero-copy">This pantry is not stored in this browser. It may have been deleted.</p>
      <Link className="secondary-button" to="/pantries">Back to My Pantries</Link>
    </section>
  )
}
