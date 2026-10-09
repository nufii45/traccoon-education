import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Add01Icon, ArrowDown01Icon, File01Icon, PencilEdit02Icon, SquareLock02Icon } from '@hugeicons/core-free-icons'
import rokkiMark from '../assets/rokki-educ.webp'
import { Icon } from '../components/Icon/Icon'
import { groupPantriesByRecency, isManualPantry } from '../features/pantries/pantryGroups'
import type { PantrySummary } from '../features/pantries/repository'
import { isPantriesPath, NAV_ITEMS, pantryPath, type NavItem } from './navigation'

interface SidebarProps {
  summaries: PantrySummary[]
  activePantryId?: string
  onNewSource: () => void
}

/**
 * Primary navigation. On wide screens it is a sidebar with the pantry list
 * nested under My Pantries; at 760px and below the nav becomes a bottom tab
 * bar and the pantry list lives on the My Pantries page instead.
 */
export function Sidebar({ summaries, activePantryId, onNewSource }: SidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [isPantryListOpen, setIsPantryListOpen] = useState(true)
  const pantryListId = useId()
  const pantryGroups = groupPantriesByRecency(summaries)
  const showGroupLabels = pantryGroups.length > 1
  const isInPantries = isPantriesPath(pathname)
  const isActive = (item: NavItem) => (item.id === 'pantries' ? isInPantries : pathname.startsWith(item.to))

  return (
    <aside className="sidebar" aria-label="Pantries">
      <Link className="brand" to="/pantries">
        <img alt="" className="brand-mark" height="40" src={rokkiMark} width="40" />
        <span>traccoon <b>education</b></span>
      </Link>

      <nav aria-label="Main" className="main-nav">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              {item.isAvailable ? (
                <Link
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={isActive(item) ? 'nav-link active' : 'nav-link'}
                  to={item.to}
                >
                  <Icon icon={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className="nav-link disabled">
                  <Icon icon={item.icon} />
                  <span>{item.label}</span>
                  <small className="nav-soon">Soon</small>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {isInPantries ? (
        <section aria-label="My Pantries list" className="pantry-section">
          <div className="pantry-section-header">
            <button
              aria-controls={pantryListId}
              aria-expanded={isPantryListOpen}
              className="pantry-section-toggle"
              onClick={() => setIsPantryListOpen((current) => !current)}
              type="button"
            >
              My Pantries
              <span className={isPantryListOpen ? 'chevron' : 'chevron collapsed'}><Icon icon={ArrowDown01Icon} size={16} /></span>
            </button>
            <button aria-label="New source" className="pantry-section-add" onClick={onNewSource} type="button">
              <Icon icon={Add01Icon} />
            </button>
          </div>

          <div className="pantry-nav" hidden={!isPantryListOpen} id={pantryListId}>
            {summaries.length === 0 ? (
              <p className="empty-nav">Your study sets stay on this device.</p>
            ) : (
              pantryGroups.map((group) => (
                <div
                  aria-labelledby={showGroupLabels ? `pantry-group-${group.id}` : undefined}
                  className="pantry-group"
                  key={group.id}
                  role={showGroupLabels ? 'group' : undefined}
                >
                  {showGroupLabels ? <p className="pantry-group-label" id={`pantry-group-${group.id}`}>{group.label}</p> : null}
                  {group.pantries.map((pantry) => (
                    // Buttons, not links: the privacy e2e test selects pantries by button role.
                    <button
                      aria-current={activePantryId === pantry.id ? 'page' : undefined}
                      className={activePantryId === pantry.id ? 'pantry-link active' : 'pantry-link'}
                      key={pantry.id}
                      onClick={() => navigate(pantryPath(pantry.id))}
                      type="button"
                    >
                      <span className={isManualPantry(pantry) ? 'pantry-link-icon manual' : 'pantry-link-icon'}>
                        <Icon icon={isManualPantry(pantry) ? PencilEdit02Icon : File01Icon} />
                      </span>
                      <span>{pantry.title}</span>
                      <small>{pantry.cardCount} {pantry.cardCount === 1 ? 'card' : 'cards'}</small>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <div className="sidebar-footer">
        <Icon icon={SquareLock02Icon} size={16} />
        Local Private: no study content sent for generation
      </div>
    </aside>
  )
}
