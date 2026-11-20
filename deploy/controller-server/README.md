# The controller server's part

UniFi sends a guest's phone to the controller server's IP, and Apache on
it passes the phone on to Foyer. These two files let it show a page of
its own when Foyer can't be reached:

- `foyer-proxy.conf`: the Apache lines (replace the one that sends
  `/guest/s/` to Foyer)
- `foyer-down.html`: the "Wi-Fi sign-in is temporarily unavailable"
  page, copied to `/var/www/foyer-down/foyer-down.html`

Apache older than 2.4.47 doesn't take a list after `ProxyErrorOverride`:
use `ProxyErrorOverride On` there instead.
