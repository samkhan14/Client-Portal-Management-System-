<!DOCTYPE html>
<html lang="en" data-theme="{{ in_array(request()->cookie('theme'), ['light', 'dark'], true) ? request()->cookie('theme') : '' }}" @class(['dark' => request()->cookie('theme') === 'dark'])>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title inertia>Client Portal</title>
    <script>
        (function () {
            var preset = document.documentElement.getAttribute('data-theme');
            var theme = preset === 'light' || preset === 'dark' ? preset : null;
            if (!theme) {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.classList.toggle('dark', theme === 'dark');
        })();
    </script>
    <link rel="icon" href="/brand/mark.jpg" type="image/jpeg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
    @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="min-h-screen bg-paper text-ink antialiased">
    @inertia
</body>
</html>
