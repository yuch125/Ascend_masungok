-- iPad Photos exports commonly use a QuickTime/MOV container. This changes
-- accepted formats only; the existing private bucket and RLS stay in effect.
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','video/mp4','video/webm','video/quicktime']
where id = 'community-media';
