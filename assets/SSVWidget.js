class SSVWidget {
    #videoElement;
    #sourceElement;
    #canvasElement;
    #audio;
    #backgroundAudio;
    #rive;
    #firstPlay;
    #firstPlayHandlers = [];
    #playHandlers = [];
    #playHandlersExceptFirst = [];
    #pauseHandlers = [];
    #endHandlers = [];
    #videoUrl;
    #riveUrl;
    #audioDefaultUrl;
    #audioCustomBaseUrl;
    #audioBackgroundUrl;
    #customAudioGenerateUrl;
    #recheckCustomAudio = false;
    #posterUrl;
    #opengraphImageUrl;
    #riveStateMachine;
    #riveMainArtboard;
    #riveOpenLinkUrl;
    #posterUrlVarNames = [];
    #posterUrlCorrespondingTags = [];
    #showPosterImage = false;
    #pageViewWebhookUrl;
    #videoViewWebhookUrl;
    #ctaButtonWebhookUrl;
    #pageViewNotificationEnabled = false;
    #videoViewNotificationEnabled = false;
    #webhookData = {};
    #tags = [];
    #overwriteOpengraph = false;
    #autoplay = false;
    #pageStatus = 'focus';
    #videoStatus = 'not-started';
    #sessionID = null;
    #videoDuration = 0;
    #buttonClicked = false;
    #videoUrls = [];
    #isMultiVideoMode = false;
    #choiceVideosPlayedCount = 0;
    #currentChoiceIndex = null;
    #choicesOverlayElement;

    constructor() {
        this.#firstPlay     = true;

        this.#videoElement  = document.createElement('video');
        this.#sourceElement = document.createElement('source');
        this.#canvasElement = document.createElement('canvas');

        this.#videoElement.addEventListener('loadedmetadata', () => {this.#videoDuration = this.#videoElement.duration});
        this.#videoElement.addEventListener('play',  () => {this.#playHandler()});
        this.#videoElement.addEventListener('pause', () => {this.#pauseHandler()});
        this.#videoElement.addEventListener('ended', () => {this.#endHandler()});
        window.addEventListener('blur', () => {this.#pageStatus = 'blur'});
        window.addEventListener('focus', () => {this.#pageStatus = 'focus'});
        this.#sessionID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        // Added CTA button tracking
        const ctaButtons = document.querySelectorAll('[id^="cta-button"]');
        ctaButtons.forEach(button => {
            if (button.id.startsWith('cta-button')) {
                button.addEventListener('click', () => {this.#buttonClickedHandler()});
            }
        });
    }

    construct(container = null) {
        this.#mapWebhookDataWithQueryParameters();

        this.generateCustomAudio();

        const pageUrl = window.location.href ?? document.URL;
        const queryParams = (new URL(pageUrl).search);
        let video_url = pageUrl.slice(0, (pageUrl.length - queryParams.length));
        video_url += `/${this.#webhookData['tag1']}`;
        video_url += `/${this.#webhookData['tag2']}`;
        video_url += `/${this.#webhookData['tag3']}`;
        video_url += `/${this.#webhookData['tag4']}`;
        this.addWebhookData('video_url', video_url);
        this.addWebhookData('userAgent', window.navigator.userAgent);
        this.addWebhookData('url', window.location.href);

        // if (this.#videoUrl) {
            if (
                !this.#riveUrl ||
                !this.#riveStateMachine ||
                !this.#riveMainArtboard
            ) {
                this.#videoElement.controls = true;

                if (this.#autoplay) {
                    this.#videoElement.autoplay = true;
                    this.#videoElement.muted = true;
                    this.#videoElement.playsInline = true;
                }

                if (this.#showPosterImage) {
                    this.#resolvePosterUrlVar();
                    this.#videoElement.setAttribute('poster', this.#posterUrl);
                }
            }

            this.#videoElement.setAttribute('playsinline', '');
            this.#videoElement.setAttribute('webkit-playsinline', '');

            this.#displayVideo(container);

            if (this.#pageViewWebhookUrl && this.#pageViewNotificationEnabled) {
                this.#webhookData['type'] = 'Page View';
                fetch(this.#pageViewWebhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.#webhookData)
                });
                this.#pageActivity('trigger', 'page-opened');
            }
        // } else {
        //     alert('Add video url');
        // }

        setInterval(() => {
            this.#pageActivity('heartbeat', 'beat');
        }, 1000);

    }

    #pageActivity(type, event) {
        fetch(`https://admin.sixtyseconds.video/api/v2/landing-page-activity/new`, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'sessionID': this.#sessionID,
                'type': type,
                'event': event,
                'userAgent': window.navigator.userAgent,
                'url': window.location.href,
                'pageStatus': this.#pageStatus,
                'videoStatus': this.#videoStatus,
                'videoDuration': this.#videoDuration,
                'campaignID': this.#webhookData['tag7'] ?? "N/A",
                'tag1': this.#webhookData['tag1'] ?? "N/A",
                'tag2': this.#webhookData['tag2'] ?? "N/A",
                'tag3': this.#webhookData['tag3'] ?? "N/A",
                'beatInterval': 1,
            })
        });
    }

    #mapWebhookDataWithQueryParameters() {
        const url = window.location.href ?? document.URL;
        const queryParams = new URLSearchParams(new URL(url).search);
        if (queryParams.has('t')) {
            const hashedParam = queryParams.get('t');
            let param = "";
            try {
                const decodedB64Param = atob(hashedParam);
                param = decodedB64Param.includes('tag') ? decodedB64Param : this.#decrypt("sixtyseconds@02424", hashedParam)
            } catch (e) {
                param = this.#decrypt("sixtyseconds@02424", hashedParam)
            }

            const params = param.split('&');
            for (const param of params) {
                this.#webhookData[param.split('=')[0]] = param.split('=')[1];

                // If tag6 is present in the query parameters, then it is considered as video_id
                if (param.split('=')[0] === 'tag6') {
                    this.#webhookData['video_id'] = param.split('=')[1];
                }
            }
        } else {
            queryParams.forEach((value, key) => {
                this.#webhookData[key] = value;
            });

            if (queryParams.has('tag6')) {
                this.#webhookData['video_id'] = queryParams.get('tag6');
            }
        }

        if (queryParams.has('tag7')) {
            this.#webhookData['tag7'] = queryParams.get('tag7');
        }
    }

    #resolvePosterUrlVar() {
        for (const key in this.#posterUrlVarNames) {
            if(this.#posterUrlVarNames[key] && this.#webhookData[this.#posterUrlCorrespondingTags[key]]) {
                this.#posterUrl = this.#posterUrl.replace(this.#posterUrlVarNames[key], this.#webhookData[this.#posterUrlCorrespondingTags[key]]).replaceAll(' ', '%20');
                this.#opengraphImageUrl = this.#opengraphImageUrl ? this.#opengraphImageUrl.replace(this.#posterUrlVarNames[key], this.#webhookData[this.#posterUrlCorrespondingTags[key]]).replaceAll(' ', '%20') : '';
            }
        }
    }

    async #displayVideo(container) {
        // this.#videoElement.style['max-height'] = '350px';
        // this.#videoElement.style['display'] = 'block';
        // this.#videoElement.style['margin'] = 'auto';
        if (!this.#isMultiVideoMode) {
            if (this.#webhookData['tag6']) {
                const response =  await fetch(`https://admin.sixtyseconds.video/api/v2/public/${this.#webhookData['tag6']}/video-url`, {method: 'GET'});
                const data = await response.json();
                if (data.success) {
                    this.#sourceElement.setAttribute('src', data.data.videoUrl);
                    this.#videoElement.appendChild(this.#sourceElement);

                    if (!this.#posterUrl) {
                        this.#videoElement.setAttribute('poster', data.data.thumbnailUrl);
                    }
                }
            } else {
                this.#sourceElement.setAttribute('src', this.#videoUrl);
                this.#videoElement.appendChild(this.#sourceElement);
            }
        } else {
            // Multi-video mode: defer setting src until a choice is clicked
            this.#videoElement.appendChild(this.#sourceElement);
        }

        if(this.#audioDefaultUrl) {
            this.#audio = new Audio(this.#audioDefaultUrl);
            this.#initAudioEventListeners(this.#audio);
        }

        if(this.#audioBackgroundUrl) {
            this.#backgroundAudio = new Audio(this.#audioBackgroundUrl);
        }

        const containerId = container ?? 'ssv_player_container';
        const containerElement = document.querySelector(`#${containerId}`);

        containerElement.style.position      = 'relative';
        containerElement.style.width         = '100%';
        containerElement.style.paddingBottom = '56.25%';

        this.#videoElement.style['position'] = 'absolute';
        this.#videoElement.style['top']      = '0';
        this.#videoElement.style['left']     = '0';
        this.#videoElement.style['width']    = '100%';
        this.#videoElement.style['height']   = '100%';

        containerElement.appendChild(this.#videoElement);
        if (
            this.#riveUrl &&
            this.#riveStateMachine &&
            this.#riveMainArtboard
        ) {

            this.#canvasElement.style['position'] = 'absolute';
            this.#canvasElement.style['top']      = '0';
            this.#canvasElement.style['left']     = '0';
            this.#canvasElement.style['width']    = '100%';
            this.#canvasElement.style['height']   = '100%';
            containerElement.appendChild(this.#canvasElement);
        }

        // No HTML fallback overlay needed with new Rive buttons; rely on Rive UI

        if (
            this.#riveUrl &&
            this.#riveStateMachine &&
            this.#riveMainArtboard
        ) {
            this.#rive = new rive.Rive({
                src: this.#riveUrl,
                stateMachines: this.#riveStateMachine,
                canvas: this.#canvasElement,
                artboard: this.#riveMainArtboard,
                autoplay: true,
                onLoad: () => {
                    this.initRiveCustomisations();
                },
            });
        }
    }

    /**
     * Setting data
     */
    setVideoUrl(videoUrl) {
        this.#videoUrl = videoUrl.trim();
    }

    setVideoUrls(url1, url2, url3) {
        this.#videoUrls = [url1.trim(), url2.trim(), url3.trim()];
        this.#isMultiVideoMode = true;
    }

    setRiveUrl(riveUrl) {
        this.#riveUrl = riveUrl.trim();
    }

    setAudioDefaultUrl(audioDefaultUrl) {
        this.#audioDefaultUrl = audioDefaultUrl.trim();
    }

    setAudioCustomBaseUrl(audioCustomBaseUrl) {
        this.#audioCustomBaseUrl = audioCustomBaseUrl.trim();
    }

    setAudioCustomGenerateUrl(audioCustomGenerateUrl) {
        this.#customAudioGenerateUrl = audioCustomGenerateUrl.trim();
    }

    setAudioBackgroundUrl(audioBackgroundUrl) {
        this.#audioBackgroundUrl = audioBackgroundUrl.trim();
    }

    setRiveStateMachine(riveStateMachine) {
        this.#riveStateMachine = riveStateMachine;
    }

    setRiveMainArtboard(riveMainArtboard) {
        this.#riveMainArtboard = riveMainArtboard;
    }

    setRiveOpenLinkUrl(riveOpenLinkUrl) {
        this.#riveOpenLinkUrl = riveOpenLinkUrl;
    }

    setOverwriteOpengraph(overwriteOpengraph) {
        this.#overwriteOpengraph = overwriteOpengraph;
    }

    setPosterUrl(posterUrl) {
        this.#posterUrl = posterUrl.trim();
    }

    setOpengraphImageUrl(opengraphImageUrl) {
        this.#opengraphImageUrl = opengraphImageUrl.trim();
    }

    setPosterUrlVarNames(posterUrlVarNames) {
        if (posterUrlVarNames.length !== 0) {
            let posterUrlVarNamesTab = posterUrlVarNames.split(',');
            posterUrlVarNamesTab = posterUrlVarNamesTab.map((posterUrlVarName) => posterUrlVarName.trim());
            this.#posterUrlVarNames = posterUrlVarNamesTab;
        }
    }

    setPosterUrlVarName(posterUrlVarNames) {
        this.setPosterUrlVarNames(posterUrlVarNames);
    }

    setPosterUrlCorrespondingTags(posterUrlCorrespondingTags) {
        if (posterUrlCorrespondingTags.length !== 0) {
            let posterUrlCorrespondingTagsTab = posterUrlCorrespondingTags.split(',');
            posterUrlCorrespondingTagsTab = posterUrlCorrespondingTagsTab.map((posterUrlCorrespondingTag) => posterUrlCorrespondingTag.trim());
            this.#posterUrlCorrespondingTags = posterUrlCorrespondingTagsTab;
        }
    }

    setPosterUrlCorrespondingTag(posterUrlCorrespondingTags) {
        this.setPosterUrlCorrespondingTags(posterUrlCorrespondingTags);
    }

    showPosterImage(showPosterImage) {
        this.#showPosterImage = showPosterImage;
    }

    setPageViewWebhookUrl(url) {
        this.#pageViewWebhookUrl = url;
    }

    setVideoViewWebhookUrl(url) {
        this.#videoViewWebhookUrl = url;
    }

    setCtaButtonWebhookUrl(url) {
        this.#ctaButtonWebhookUrl = url;
    }

    setPageViewNotificationEnabled(state) {
        this.#pageViewNotificationEnabled = state;
    }

    setVideoViewNotificationEnabled(state) {
        this.#videoViewNotificationEnabled = state;
    }

    setTags(tags) {
        if (tags.length !== 0) {
            let tagsTab = tags.split(',');
            tagsTab = tagsTab.map((tag) => tag.trim());
            this.#tags = tagsTab;
        }
    }

    setAutoPlay(autoplay) {
        this.#autoplay = autoplay;
    }

    addTag(tag) {
        this.#tags.push(tag);
    }

    addWebhookData() {
        if (arguments.length === 1) {
            for (const key in arguments[0]) {
                if (Object.hasOwnProperty.call(arguments[0], key)) {
                    this.#webhookData[key] = object[key];
                }
            }
        } else {
            this.#webhookData[arguments[0]] = arguments[1];
        }
    }

    /**
     * Setting handlers
     */
    onFirstPlay() {
        for(let i = 0; i < arguments.length ; i++) {
            if (typeof arguments[i] === 'function') {
                this.#firstPlayHandlers.push(arguments[i]);
            }
        }
    }

    onPlay() {
        for(let i = 0; i < arguments.length ; i++) {
            if (typeof arguments[i] === 'function') {
                this.#playHandlers.push(arguments[i]);
            }
        }
    }

    onPlayExceptFirst() {
        for(let i = 0; i < arguments.length ; i++) {
            if (typeof arguments[i] === 'function') {
                this.#playHandlersExceptFirst.push(arguments[i]);
            }
        }
    }

    onPause() {
        for(let i = 0; i < arguments.length ; i++) {
            if (typeof arguments[i] === 'function') {
                this.#pauseHandlers.push(arguments[i]);
            }
        }
    }

    generateCustomAudio() {
        if( this.#audioCustomBaseUrl && this.#webhookData['rca'] ) {
            const customAudio = this.#webhookData['rca'];
            if (customAudio) {
                let audioUrl = this.#audioCustomBaseUrl + customAudio + '.mp3';

                // Check if the audio file exists
                fetch(audioUrl, { mode: 'cors' })
                    .then(response => {
                        if (response.ok) {
                            // do nothing
                        } else {
                            console.error("Audio file not found:", response.statusText);

                            if( this.#customAudioGenerateUrl ) {
                                const generatedUrl = this.#customAudioGenerateUrl.replace(/{customAudioValue}/g, customAudio);
                                const xhr = new XMLHttpRequest();
                                xhr.open('GET', generatedUrl, true);
                                xhr.send();
                                this.#recheckCustomAudio = true;
                            }
                        }
                    })
                    .catch(error => {
                        console.log('Audio file does not exist');
                    });
            }
        }
    }

    initRiveCustomisations() {
        // Pull in the text-run values from the query parameters
        Object.keys(this.#webhookData).forEach(key => {
            if (key.startsWith('rtr-')) {
                const textRunKey = key.replace('rtr-', '');
                const value = this.#webhookData[key];
                if ( this.#rive.getTextRunValue(textRunKey) !== undefined ) {
                    this.#rive.setTextRunValue(textRunKey, value);
                }else{
                    this.#rive.setTextRunValueAtPath(textRunKey, value, "overlay");
                }
            }
        });

        // Check for rca param in this.#webhookData
        if( this.#audioCustomBaseUrl && this.#webhookData['rca'] ) {
            const customAudio = this.#webhookData['rca'];
            if (customAudio) {
                let audioUrl = this.#audioCustomBaseUrl + customAudio + '.mp3';
                // Verify the audio file exists
                fetch(audioUrl, { mode: 'cors' })
                    .then(response => {
                        if (response.ok) {
                            this.#audio = new Audio(audioUrl);
                            this.#initAudioEventListeners(this.#audio);
                        } else {
                            console.error("Audio file not found:", response.statusText);
                        }
                    })
                    .catch(error => {
                        console.error("Audio file not found:", error);
                    });
            }
        }

        this.#rive.resizeDrawingSurfaceToCanvas();

        // Add the event listener
        this.#rive.on(rive.EventType.RiveEvent, (event) => {
            this.#riveEventHandler(event);
        });

        this.#endHandlers.push(() => {
            const inputs = this.#rive.stateMachineInputs(this.#riveStateMachine);
            const trigger = inputs.find(i => i.name === 'main-video-ended');
            trigger.fire();
        });

        this.#endHandlers.push(() => {
            if (this.#audioBackgroundUrl) {
                this.#fadeOutAudio(this.#backgroundAudio);
            }
        });
    }

    #riveEventHandler(riveEvent) {
        console.log("RiveEvent received:", riveEvent);

        switch( riveEvent.data.name ) {
            case "intro-play-button-clicked":
                if (this.#firstPlay) {
                    if (this.#videoViewWebhookUrl && this.#videoViewNotificationEnabled) {
                        this.#webhookData['type'] = 'Video View';
                        fetch(this.#videoViewWebhookUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.#webhookData)
                        });
                    }
                    this.#firstPlay = false;
                }

                this.#videoElement.currentTime = 0;

                // If no custom audio configured and not in multi-video mode, start the single video
                if ((!this.#audioCustomBaseUrl || this.#audioCustomBaseUrl.trim() === '') && !this.#isMultiVideoMode) {
                    this.#videoElement.play().catch((error) => {
                        console.error("video playback failed:", error);
                        return;
                    });
                }

                if( this.#recheckCustomAudio ) {
                    if( this.#audioCustomBaseUrl && this.#webhookData['rca'] ) {
                        const customAudio = this.#webhookData['rca'];
                        if (customAudio) {
                            let audioUrl = this.#audioCustomBaseUrl + customAudio + '.mp3';
                            // Verify the audio file exists
                            fetch(audioUrl, { mode: 'cors' })
                                .then(response => {
                                    if (response.ok) {
                                        this.#audio = new Audio(audioUrl);
                                        this.#initAudioEventListeners(this.#audio);

                                        this.#audio?.play().catch((error) => {
                                            console.error("audio playback failed:", error);
                                            return;
                                        });
                                    } else {
                                        console.error("Unable to play audio: ", response.statusText);
                                    }
                                })
                                .catch(error => {
                                    console.error("Audio file not found: ", error);
                                });
                        }
                    }
                }else{
                    this.#audio?.play().catch((error) => {
                        console.error("audio playback failed:", error);
                        return;
                    });
                }

                if (this.#audioBackgroundUrl) {
                    this.#backgroundAudio.play().catch((error) => {
                        console.error("Background Audio playback failed:", error);
                    });
                }
                // Rive handles the transition to the three buttons; no HTML overlay
                break;
            case "video-one-trigger":
                this.#handleChoice(0);
                break;
            case "video-two-trigger":
                this.#handleChoice(1);
                break;
            case "video-three-trigger":
                this.#handleChoice(2);
                break;
            case "main-video-pause-control":
                this.#videoElement.pause();
                if (this.#audioBackgroundUrl) {
                    this.#backgroundAudio.pause();
                }
                break;
            case "main-video-play-control":
                this.#videoElement.play();
                if (this.#audioBackgroundUrl) {
                    this.#backgroundAudio.play();
                }
                break;
            case "replay-button-clicked":
                setTimeout(() => {
                    this.#rive.reset({
                        artboard: this.#riveMainArtboard,
                        stateMachines: this.#riveStateMachine,
                        autoplay: true,
                    });
                    this.initRiveCustomisations();
                    this.#rive.play(this.#riveStateMachine);

                    if (this.#audioBackgroundUrl) {
                        this.#backgroundAudio.currentTime = 0;
                        this.#backgroundAudio.volume = 1;
                        // Commented out while this.#rive.play above isn't playing ball
                        //bgAudio.play().catch((error) => {
                        //  console.error("Background Audio playback failed:", error);
                        //});
                    }
                }, 500);  // Delay to allow the animation to finish
                break;
            case "open-link":
                this.#buttonClickedHandler('Video Call to Action Clicked');
                if( this.#riveOpenLinkUrl ) {
                    setTimeout(() => {
                        window.open(
                            this.#riveOpenLinkUrl,
                        "_blank"
                    );
                    }, 500);
                }
                break;
        }
    }

    #playHandler() {
        this.#videoStatus = 'playing';
        this.#pageActivity('trigger', 'video-played');
        if (this.#firstPlay) {
            if (this.#videoViewWebhookUrl && this.#videoViewNotificationEnabled) {
                this.#webhookData['type'] = 'Video View';
                fetch(this.#videoViewWebhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.#webhookData)
                });
            }

            for (const handler of this.#firstPlayHandlers) {
                handler();
            }
            this.#firstPlay = false;
        } else {
            for (const handler of this.#playHandlersExceptFirst) {
                handler();
            }
        }
        for (const handler of this.#playHandlers) {
            handler();
        }
    }

    #pauseHandler() {
        this.#videoStatus = 'paused';
        this.#pageActivity('trigger', 'video-paused');
        for (const handler of this.#pauseHandlers) {
            handler();
        }
    }

    #endHandler() {
        this.#videoStatus = 'ended';
        this.#pageActivity('trigger', 'video-ended');

        if (this.#isMultiVideoMode) {
            this.#choiceVideosPlayedCount += 1;
            // Show Rive canvas again; Rive state machine handles showing buttons
            this.#showRiveCanvas();
        }
        for (const handler of this.#endHandlers) {
            handler();
        }
    }

    #initAudioEventListeners(audio) {
        audio.addEventListener('ended', () => {
            // For multi-video flow, do not drive transitions from audio end.
            if (this.#isMultiVideoMode) { return; }
            // Single-video legacy flow: fire Rive trigger and start video.
            const inputs = this.#rive.stateMachineInputs(this.#riveStateMachine);
            const trigger = inputs.find(i => i.name === 'audio-ended');
            if (trigger) { trigger.fire(); }
            this.#videoElement.play();
        });
    };

    #fadeOutAudio(audio) {
        let fadeOutInterval = setInterval(() => {
            if (audio.volume > 0.1) {
                audio.volume -= 0.1;
            } else {
                audio.volume = 0;
                audio.pause();
                clearInterval(fadeOutInterval);
            }
        }, 200);
    }

    #decrypt(salt, encoded) {
        const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
        const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
        return encoded
        .match(/.{1,2}/g)
        .map((hex) => parseInt(hex, 16))
        .map(applySaltToChar)
        .map((charCode) => String.fromCharCode(charCode))
        .join("");
    };

    #fireRiveTrigger(triggerName) {
        try {
            const inputs = this.#rive?.stateMachineInputs(this.#riveStateMachine) ?? [];
            const trigger = inputs.find(i => i.name === triggerName);
            if (trigger && typeof trigger.fire === 'function') {
                trigger.fire();
            }
        } catch (e) {
            // Rive may not be ready; ignore
        }
    }

    #hideRiveCanvas() {
        if (this.#canvasElement) {
            this.#canvasElement.style.display = 'none';
        }
    }

    #showRiveCanvas() {
        if (this.#canvasElement) {
            this.#canvasElement.style.display = 'block';
        }
    }

    #createChoicesOverlay(containerElement) {
        this.#choicesOverlayElement = document.createElement('div');
        this.#choicesOverlayElement.style.position = 'absolute';
        this.#choicesOverlayElement.style.top = 'auto';
        this.#choicesOverlayElement.style.bottom = '24px';
        this.#choicesOverlayElement.style.left = '50%';
        this.#choicesOverlayElement.style.transform = 'translateX(-50%)';
        this.#choicesOverlayElement.style.width = 'auto';
        this.#choicesOverlayElement.style.height = 'auto';
        this.#choicesOverlayElement.style.display = 'none';
        this.#choicesOverlayElement.style.alignItems = 'center';
        this.#choicesOverlayElement.style.justifyContent = 'center';
        this.#choicesOverlayElement.style.gap = '12px';
        this.#choicesOverlayElement.style.zIndex = '10';
        this.#choicesOverlayElement.style.background = 'transparent';
        this.#choicesOverlayElement.style.flexDirection = 'row';
        this.#choicesOverlayElement.style.boxSizing = 'border-box';
        this.#choicesOverlayElement.style.padding = '0';
        this.#choicesOverlayElement.style.backdropFilter = '';
        this.#choicesOverlayElement.style.webkitBackdropFilter = '';
        this.#choicesOverlayElement.style.textAlign = 'center';
        this.#choicesOverlayElement.style.pointerEvents = 'none';
        this.#choicesOverlayElement.style.display = 'flex';

        const makeButton = (label, index) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.padding = '12px 16px';
            btn.style.fontSize = '16px';
            btn.style.borderRadius = '8px';
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.background = '#ffffff';
            btn.style.color = '#000000';
            btn.style.pointerEvents = 'auto';
            btn.addEventListener('click', () => {
                this.#handleChoice(index);
            });
            return btn;
        };

        const c1 = makeButton('Video 1', 0);
        const c2 = makeButton('Video 2', 1);
        const c3 = makeButton('Video 3', 2);

        this.#choicesOverlayElement.appendChild(c1);
        this.#choicesOverlayElement.appendChild(c2);
        this.#choicesOverlayElement.appendChild(c3);

        this.#choicesOverlayElement.style.display = 'none';
        containerElement.appendChild(this.#choicesOverlayElement);
        this.#hideChoices();
    }

    #showChoices() {
        if (this.#choicesOverlayElement) {
            this.#choicesOverlayElement.style.display = 'flex';
        }
        this.#showRiveCanvas();
        this.#fireRiveTrigger('show-choices');
        this.#fireRiveTrigger('show-cta');
    }

    #hideChoices() {
        if (this.#choicesOverlayElement) {
            this.#choicesOverlayElement.style.display = 'none';
        }
        this.#fireRiveTrigger('hide-choices');
        this.#fireRiveTrigger('hide-cta');
    }

    #loadAndPlayVideoByIndex(index) {
        if (!this.#videoUrls || this.#videoUrls.length < 3) { return; }
        if (index < 0 || index > 2) { return; }
        this.#currentChoiceIndex = index;
        const url = this.#videoUrls[index];
        if (url) {
            this.#sourceElement.setAttribute('src', url);
            this.#videoElement.load();
            this.#videoElement.play().catch((error) => {
                console.error('video playback failed:', error);
            });
        }
    }

    // Unified handler for user choice (Rive buttons or HTML overlay)
    #handleChoice(index) {
        // Fire specific Rive trigger for the chosen video, then fire audio-ended as required by the brief
        const triggerMap = ['video-one-trigger', 'video-two-trigger', 'video-three-trigger'];
        const chosenTrigger = triggerMap[index];
        // if (chosenTrigger) { this.#fireRiveTrigger(chosenTrigger); }
        this.#fireRiveTrigger('audio-ended');

        // Fast fade-out of main and background audio
        if (this.#audio) { this.#audio.pause(); }
        if (this.#backgroundAudio) { this.#backgroundAudio.pause(); }

        // Proceed to play the selected video
        this.#loadAndPlayVideoByIndex(index);
    }

    // Added CTA button click handler
    #buttonClickedHandler(type = 'Page Call to Action Clicked') {
        if (this.#ctaButtonWebhookUrl && !this.#buttonClicked) {
            this.#buttonClicked = true;
            this.#webhookData['type'] = type;
            fetch(this.#ctaButtonWebhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.#webhookData)
            });
        }
    }
}