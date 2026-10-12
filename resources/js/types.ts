export type SharedProps = {
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
            theme: string | null;
            is_platform_admin: boolean;
        } | null;
        membership: {
            id: number;
            role: string;
            role_label: string;
            client_company_id: number | null;
        } | null;
        organization: { id: number; name: string } | null;
    };
    flash: { success?: string | null; error?: string | null };
    unread_notifications: number;
    theme: string | null;
    notification_preferences: {
        assignments: boolean;
        due_soon: boolean;
        comments: boolean;
        deliverables: boolean;
        status_changes: boolean;
        invitations: boolean;
    } | null;
    abilities: {
        manage_organization: boolean;
        manage_projects: boolean;
        invite: boolean;
        invoice: boolean;
        view_invoices: boolean;
    };
};

export type Pager<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
};

export type Option = { id: number; name: string };

export type TaskRow = {
    id: number;
    project_id: number;
    project_name: string | null;
    title: string;
    description: string | null;
    status: string;
    status_label: string;
    priority: string;
    priority_label: string;
    assignee: { id: number; name: string } | null;
    milestone: { id: number; name: string } | null;
    parent_id: number | null;
    prerequisite_task_id: number | null;
    start_date: string | null;
    due_date: string | null;
    estimate_hours: string | number | null;
    client_visible: boolean;
};
