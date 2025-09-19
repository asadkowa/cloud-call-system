# FreeSWITCH PBX Container
FROM debian:bullseye-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg2 \
    software-properties-common \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Add FreeSWITCH repository
RUN wget --http-user=signalwire --http-password=pat_CRnvWq8tkHdHAj6SRn5BJ5ZFvxDcpvCa4KJRRW6VJ9N \
    -O - https://freeswitch.signalwire.com/repo/deb/debian-release/signalwire-freeswitch-repo.gpg | \
    apt-key add -

RUN echo "machine freeswitch.signalwire.com login signalwire password pat_CRnvWq8tkHdHAj6SRn5BJ5ZFvxDcpvCa4KJRRW6VJ9N" > /etc/apt/auth.conf
RUN chmod 600 /etc/apt/auth.conf

RUN echo "deb https://freeswitch.signalwire.com/repo/deb/debian-release/ bullseye main" > /etc/apt/sources.list.d/freeswitch.list

# Update and install FreeSWITCH
RUN apt-get update && apt-get install -y \
    freeswitch \
    freeswitch-meta-bare \
    freeswitch-meta-default \
    freeswitch-meta-codecs \
    freeswitch-conf-vanilla \
    freeswitch-mod-commands \
    freeswitch-mod-console \
    freeswitch-mod-logfile \
    freeswitch-mod-enum \
    freeswitch-mod-cdr-csv \
    freeswitch-mod-event-socket \
    freeswitch-mod-sofia \
    freeswitch-mod-loopback \
    freeswitch-mod-conference \
    freeswitch-mod-db \
    freeswitch-mod-dptools \
    freeswitch-mod-expr \
    freeswitch-mod-fifo \
    freeswitch-mod-hash \
    freeswitch-mod-voicemail \
    freeswitch-mod-esf \
    freeswitch-mod-fsv \
    freeswitch-lang-en \
    freeswitch-mod-say-en \
    freeswitch-sounds-en-us-callie \
    freeswitch-mod-native-file \
    freeswitch-mod-local-stream \
    freeswitch-mod-tone-stream \
    freeswitch-mod-lua \
    freeswitch-mod-xml-cdr \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /var/log/freeswitch \
    /var/lib/freeswitch/recordings \
    /var/lib/freeswitch/storage \
    /etc/freeswitch/sip_profiles \
    /etc/freeswitch/directory/default

# Set permissions
RUN chown -R freeswitch:freeswitch /var/log/freeswitch
RUN chown -R freeswitch:freeswitch /var/lib/freeswitch
RUN chown -R freeswitch:freeswitch /etc/freeswitch

# Copy configuration files
COPY config/ /etc/freeswitch/

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports
EXPOSE 5060/udp 5060/tcp     # SIP
EXPOSE 5080/udp 5080/tcp     # SIP (alternative)
EXPOSE 8021/tcp              # Event Socket Library
EXPOSE 10000-20000/udp       # RTP media ports

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD fs_cli -x "status" || exit 1

# Run supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]