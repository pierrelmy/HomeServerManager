import {
  IconBolt,
  IconMoon,
  IconUserCircle,
  IconSettings,
  IconServer,
  IconApps,
  IconBrandDocker,
  IconChartBar,
  IconTerminal2,
  IconTools,
  IconSun,
  IconDeviceDesktop,
  type IconProps,
} from "@tabler/icons-react"
import { NavLink } from "react-router-dom"
import { useHomelabLiveManager, useHomelabSettings } from "../live/useHomelabLive"
import { SegmentedControl } from "./ui"

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
  const liveManager = useHomelabLiveManager()
  const settings = useHomelabSettings()

  const updateTheme = async (theme: "system" | "light" | "dark") => {
    if (!settings || settings.theme === theme) return
    await liveManager.updateSettings({ ...settings, theme })
  }

  return (
    <aside className={`shrink-0 border-b border-slate-200 bg-slate-950 text-slate-300 md:min-h-screen md:border-b-0 md:border-r md:border-slate-800 ${settings?.compactSidebar ? "md:w-24" : "md:w-72"}`}>
      <div>
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
              <IconBolt size={20} stroke={2.2} />
            </div>
            <div className={settings?.compactSidebar ? "hidden md:block" : ""}>
              <p className="text-sm font-semibold text-white">HomeServerManager</p>
              <p className="text-xs text-slate-400">Admin console</p>
            </div>
          </div>
          <div className={`mt-4 ${settings?.compactSidebar ? "block md:hidden" : ""}`}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Theme</div>
            <SegmentedControl
              size="sm"
              value={settings?.theme ?? "system"}
              onChange={updateTheme}
              options={[
                { value: "light", label: "Clair", icon: <IconSun size={14} /> },
                { value: "dark", label: "Sombre", icon: <IconMoon size={14} /> },
                { value: "system", label: "Auto", icon: <IconDeviceDesktop size={14} /> },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 py-4 sm:grid-cols-3 md:flex md:flex-col">
          <span className={`px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${settings?.compactSidebar ? "hidden md:block" : ""}`}>Workspace</span>
        {topIcons.map(({ id, icon: Icon, label, path }) => (
          <SidebarButton
            key={id}
            label={label}
            path={path}
            end={path === "/"}
          >
            <div className={`flex items-center gap-3 ${settings?.compactSidebar ? "justify-center md:justify-start" : ""}`}>
              <Icon size={22} stroke={1.75} />
              <span className={`${settings?.compactSidebar ? "hidden md:inline" : ""}`}>{label}</span>
            </div>
          </SidebarButton>
        ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-4 md:flex md:flex-col">
        <span className={`px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 ${settings?.compactSidebar ? "hidden md:block" : ""}`}>Preferences</span>
        {bottomIcons.map(({ id, icon: Icon, label, path }) => (
          <SidebarButton
            key={id}
            label={label}
            path={path}
          >
            <div className={`flex items-center gap-3 ${settings?.compactSidebar ? "justify-center md:justify-start" : ""}`}>
              <Icon size={22} stroke={1.75} />
              <span className={`${settings?.compactSidebar ? "hidden md:inline" : ""}`}>{label}</span>
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
        `inline-flex w-full min-w-0 items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
          isActive
            ? "bg-sky-500/20 text-white ring-1 ring-inset ring-sky-400/40"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  )
}
