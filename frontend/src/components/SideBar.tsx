import {
  IconApps,
  IconBolt,
  IconBrandDocker,
  IconChartBar,
  IconDeviceDesktop,
  IconMenu2,
  IconMoon,
  IconServer,
  IconSettings,
  IconSun,
  IconTerminal2,
  IconTools,
  IconUserCircle,
  IconX,
  type IconProps,
} from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { useHomelabLiveManager, useHomelabSettings } from "../live/useHomelabLive"
import { SegmentedControl } from "./ui"

interface SideBarElement {
  id: string
  icon: React.ForwardRefExoticComponent<
    IconProps & React.RefAttributes<SVGSVGElement>
  >
  label: string
  path: string
  mobile?: boolean
}

const topIcons: SideBarElement[] = [
  { id: "stats", icon: IconChartBar, label: "Overview", path: "/", mobile: true },
  { id: "nas", icon: IconServer, label: "NAS", path: "/nas", mobile: true },
  { id: "services", icon: IconApps, label: "Services", path: "/services", mobile: true },
  { id: "docker", icon: IconBrandDocker, label: "Docker", path: "/docker", mobile: true },
  { id: "terminal", icon: IconTerminal2, label: "Terminal", path: "/terminal" },
  { id: "tools", icon: IconTools, label: "Tools", path: "/tools" },
]

const bottomIcons: SideBarElement[] = [
  {
    id: "account",
    icon: IconUserCircle,
    label: "Account",
    path: "/account",
  },
  {
    id: "settings",
    icon: IconSettings,
    label: "Settings",
    path: "/settings",
    mobile: true,
  },
]

function useCompactSidebar(forceCompact: boolean) {
  const [compact, setCompact] = useState(forceCompact)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)")

    const update = () => {
      setCompact(forceCompact || media.matches)
    }

    update()

    media.addEventListener("change", update)

    return () => media.removeEventListener("change", update)
  }, [forceCompact])

  return compact
}

function MobileNavigation({
  onOpenMenu,
}: {
  onOpenMenu: () => void
}) {
  const items = topIcons.filter((item) => item.mobile).slice(0, 4)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-around py-2">
        {items.map(({ id, icon: Icon, label, path }) => (
          <NavLink
            key={id}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                isActive
                  ? "text-sky-500"
                  : "text-slate-500 dark:text-slate-400"
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[11px]">{label}</span>
          </NavLink>
        ))}

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
        >
          <IconMenu2 size={22} />
          <span className="text-[11px]">More</span>
        </button>
      </div>
    </nav>
  )
}

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <>
      <button
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
      />

      <aside className="fixed right-0 top-0 bottom-0 z-50 flex w-72 flex-col bg-white shadow-2xl md:hidden dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white">
              <IconBolt size={18} />
            </div>

            <div>
              <p className="font-semibold">HomeServerManager</p>
              <p className="text-xs text-slate-500">Navigation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          {topIcons.map(({ id, icon: Icon, label, path }) => (
            <SidebarButton
              key={id}
              label={label}
              path={path}
              end={path === "/"}
            >
              <div className="flex items-center gap-3">
                <Icon size={22} />
                <span>{label}</span>
              </div>
            </SidebarButton>
          ))}

          <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

          {bottomIcons.map(({ id, icon: Icon, label, path }) => (
            <SidebarButton
              key={id}
              label={label}
              path={path}
            >
              <div className="flex items-center gap-3">
                <Icon size={22} />
                <span>{label}</span>
              </div>
            </SidebarButton>
          ))}
        </div>
      </aside>
    </>
  )
}

export default function Sidebar() {
  const liveManager = useHomelabLiveManager()
  const settings = useHomelabSettings()

  const [drawerOpen, setDrawerOpen] = useState(false)

  const compact = useCompactSidebar(settings?.compactSidebar ?? false)

  const updateTheme = async (theme: "system" | "light" | "dark") => {
    if (!settings || settings.theme === theme) return
    await liveManager.updateSettings({
      ...settings,
      theme,
    })
  }

  return (
    <>
      <aside
        className={`hidden shrink-0 border-r border-slate-200 bg-white text-slate-700 md:flex md:sticky md:top-0 md:h-screen md:self-start md:flex-col dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 ${
          compact ? "md:w-24" : "md:w-72"
        }`}
      >
        <div className="flex min-h-screen flex-col">
          <div className="border-b border-slate-200 px-4 py-5 dark:border-slate-800">
            <div
              className={`flex items-center ${
                compact ? "justify-center" : "gap-3"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/20">
                <IconBolt size={20} stroke={2.2} />
              </div>

              {!compact && (
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    HomeServerManager
                  </p>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Admin console
                  </p>
                </div>
              )}
            </div>

            {!compact && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Theme
                </div>

                <SegmentedControl
                  size="sm"
                  value={settings?.theme ?? "system"}
                  onChange={updateTheme}
                  options={[
                    {
                      value: "light",
                      label: "Clair",
                      icon: <IconSun size={14} />,
                    },
                    {
                      value: "dark",
                      label: "Sombre",
                      icon: <IconMoon size={14} />,
                    },
                    {
                      value: "system",
                      label: "Auto",
                      icon: <IconDeviceDesktop size={14} />,
                    },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
            {!compact && (
              <span className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </span>
            )}

            {topIcons.map(({ id, icon: Icon, label, path }) => (
              <SidebarButton
                key={id}
                label={label}
                path={path}
                end={path === "/"}
              >
                <div
                  className={`flex items-center ${
                    compact ? "justify-center" : "gap-3"
                  }`}
                >
                  <Icon size={22} stroke={1.75} />

                  {!compact && <span>{label}</span>}
                </div>
              </SidebarButton>
            ))}
          </div>

          <div className="border-t border-slate-200 px-3 py-4 dark:border-slate-800">
            {!compact && (
              <span className="mb-2 block px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Preferences
              </span>
            )}

            {bottomIcons.map(({ id, icon: Icon, label, path }) => (
              <SidebarButton
                key={id}
                label={label}
                path={path}
              >
                <div
                  className={`flex items-center ${
                    compact ? "justify-center" : "gap-3"
                  }`}
                >
                  <Icon size={22} stroke={1.75} />

                  {!compact && <span>{label}</span>}
                </div>
              </SidebarButton>
            ))}
          </div>
        </div>
      </aside>

      <MobileNavigation
        onOpenMenu={() => setDrawerOpen(true)}
      />

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
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
        [
          "group inline-flex w-full min-w-0 items-center rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/20 dark:text-white dark:ring-sky-400/40"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  )
}
