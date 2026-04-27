import { Sidebar as KumoSidebar } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";

export type SidebarEntry = {
  path: string;
  label: string;
  icon: Icon;
};

export type SidebarGroup = {
  label: string;
  entries: SidebarEntry[];
};

export function Sidebar({
  groups,
  activePath,
  onNavigate,
}: {
  groups: SidebarGroup[];
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <KumoSidebar className="shrink-0 border-r vol-hairline bg-kumo-canvas">
      <KumoSidebar.Content className="gap-5 px-3 py-5">
        {groups.map((group) => (
          <KumoSidebar.Group key={group.label}>
            <KumoSidebar.GroupLabel>{group.label}</KumoSidebar.GroupLabel>
            <KumoSidebar.Menu>
              {group.entries.map((entry) => {
                const isActive = entry.path === activePath;
                const IconComponent = entry.icon;

                return (
                  <KumoSidebar.MenuButton
                    key={entry.path}
                    type="button"
                    size="sm"
                    active={isActive}
                    onClick={() => onNavigate(entry.path)}
                    aria-current={isActive ? "page" : undefined}
                    icon={
                      <IconComponent
                        size={14}
                        weight={isActive ? "fill" : "regular"}
                        className={isActive ? "text-kumo-brand" : undefined}
                      />
                    }
                  >
                    {entry.label}
                  </KumoSidebar.MenuButton>
                );
              })}
            </KumoSidebar.Menu>
          </KumoSidebar.Group>
        ))}
      </KumoSidebar.Content>
    </KumoSidebar>
  );
}
