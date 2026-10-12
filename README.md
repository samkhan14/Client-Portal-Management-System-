# Client Portal Management System

Agency workspace and client portal for a fictional studio, **Northline Studio**. The product covers onboarding, projects, milestones, tasks, deliverable review, and completion in one Laravel application.

## Stack

Laravel 13, Inertia.js, React, TypeScript, Tailwind CSS, and MySQL. This environment runs **MariaDB 10.11** through the MySQL protocol (`DB_CONNECTION=mysql`). MariaDB is the MySQL-compatible engine used here; application code and migrations target that protocol. Tests use PHPUnit (Pest is not installed).

There is no separate REST API, payment provider, or workflow engine. Mail is stored as queued `outbound_messages` rows. SMTP is not configured.

## Setup

```bash
cp .env.example .env
php artisan key:generate
```

Create the databases and user (adjust if you already have MySQL):

```sql
CREATE DATABASE client_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE client_portal_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'portal'@'localhost' IDENTIFIED BY 'portal';
GRANT ALL ON client_portal.* TO 'portal'@'localhost';
GRANT ALL ON client_portal_testing.* TO 'portal'@'localhost';
FLUSH PRIVILEGES;
```

```bash
php artisan migrate --seed
npm install
npm run dev
php artisan serve
```

Production assets: `npm run build`. Due-soon notices: `php artisan portal:scan-due-tasks` (also scheduled daily at 08:00).

If MariaDB is installed but systemd cannot start it in a sandbox, the process can be started directly:

```bash
sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld
sudo mariadbd --user=mysql --datadir=/var/lib/mysql --bind-address=127.0.0.1 --port=3306 \
  --socket=/run/mysqld/mysqld.sock --pid-file=/run/mysqld/mysqld.pid \
  --innodb-use-native-aio=0 --thread-handling=pool-of-threads
```

On a normal machine, `sudo service mariadb start` is enough.

## Demo

Every seeded password is `password`. Addresses are fictional.

| Person | Email | Role |
| --- | --- | --- |
| Ada Okonkwo | ada@northline.example | Platform admin (agency list only) |
| Mara Ellison | mara@northline.example | Agency owner |
| Jonah Hale | jonah@northline.example | Project manager |
| Priya Shah | priya@northline.example | Team member on Brightwater work |
| Lena Cho | lena@northline.example | Team member on Kite & Co. |
| Camille Bright | camille@brightwater.example | Client admin, Brightwater Foods |
| Owen Pike | owen@brightwater.example | Collaborator, Harbor project only |
| Ruth Gale | ruth@brightwater.example | Read only, Harbor project only |
| Helen Cho | helen@kiteandco.example | Client admin, Kite & Co. |
| Nico Vale | nico@kiteandco.example | Collaborator with no project membership |

Harbor packaging (`NL-2401`) has an approved deliverable version that later drafts do not overwrite. Spring tasting (`NL-2402`) is waiting on the client. Kite identity (`NL-2408`) is a second company so client data stays separated.

## Theme

A saved choice is stored on the user and in a `theme` cookie the server reads for the first paint. With no saved choice, the first visit follows the system preference.

## Authorization

The organization is the tenant. Route bindings return 404 for records outside the user's organizations. Policies return 403 inside the organization when the role cannot act. Client queries also drop internal notes, staff-only files, estimates, draft deliverables, time entries, and private activity text.

## Tests

```bash
php artisan test
npm run typecheck
npm run build
vendor/bin/pint --test
```
