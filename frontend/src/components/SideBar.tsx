import {
  IconBolt,
  IconUserCircle,
  IconSettings,
  IconServer,
  IconApps,
  IconBrandDocker,
  IconChartBar,
  IconTerminal2,
  IconTools,
  type IconProps,
} from "@tabler/icons-react"
import { NavLink } from "react-router-dom"

interface SideBarElement {
    id: string,
    icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>
    label: string,
    path: string
}

const topIcons: SideBarElement[] = [
    { id: "stats", icon: IconChartBar, label: "Overview", path: "/" },
    { id: "nas", icon: IconServer, label: "NAS", path: "/nas" },
    { id: "services", icon: IconApps, label: "Services", path: "/services" },
    { id: "docker", icon: IconBrandDocker, label: "Docker", path: "/docker" },
    { id: "terminal", icon: IconTerminal2, label: "Terminal", path: "/terminal" },
    { id: "tools", icon: IconTools, label: "Tools", path: "/tools" },
]

const bottomIcons: SideBarElement[] = [
  { id: "account", icon: IconUserCircle, label: "Account", path: "/account" },
  { id: "settings", icon: IconSettings, label: "Settings", path: "/settings" },
]

export default function Sidebar() {
  return (
    <aside className="app-sidebar d-flex flex-column justify-content-between flex-shrink-0">
      <div>
        <div className="app-sidebar__brand d-flex align-items-center gap-3">
          <div className="app-sidebar__brand-mark">
            <IconBolt size={20} stroke={2.2} />
          </div>
          <div>
            <p className="app-sidebar__brand-title">HomeServerManager</p>
            <p className="app-sidebar__brand-subtitle">Admin console</p>
          </div>
        </div>

        <div className="app-sidebar__group d-flex flex-row flex-md-column gap-2">
          <span className="app-sidebar__group-label">Workspace</span>
        {topIcons.map(({ id, icon: Icon, label, path }) => (
          <SidebarButton
            key={id}
            label={label}
            path={path}
            end={path === "/"}
          >
            <div className="d-flex flex-row align-items-center justify-content-start gap-2">
              <Icon size={22} stroke={1.75} />
              <span className="fs-5">{label}</span>
            </div>
          </SidebarButton>
        ))}
        </div>
      </div>

      <div className="app-sidebar__group d-flex flex-row flex-md-column gap-2">
        <span className="app-sidebar__group-label">Preferences</span>
        {bottomIcons.map(({ id, icon: Icon, label, path }) => (
          <SidebarButton
            key={id}
            label={label}
            path={path}
          >
            <div className="d-flex flex-row align-items-center justify-content-start gap-2">
              <Icon size={22} stroke={1.75} />
              <span className="fs-5">{label}</span>
            </div>
          </SidebarButton>
        ))}
      </div>
    </aside>
  )
}

function SidebarButton({
  children,
  label,
  path,
  end = false,
}: {
  children: React.ReactNode
  label: string
  path: string
  end?: boolean
}) {
  return (
    <NavLink
      to={path}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `btn ${isActive ? "btn-primary" : "btn-light"} app-sidebar__button d-flex flex-row align-items-center justify-content-start p-0`
      }
    >
      {children}
    </NavLink>
  )
}
