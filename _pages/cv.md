---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
* **Ph.D. Candidate in Electronic Science and Technology**, ShanghaiTech University, Shanghai, China  
  2020 – Expected Jul. 2026  
  *Advisor: Prof. Pingqiang Zhou*

* **B.Eng. in Electronic Engineering**, ShanghaiTech University, Shanghai, China  
  2016 – 2020

Projects
======
* **AI-Driven Electromagnetic Simulation Acceleration Technology**  
  *EDA Challenge-Based R&D Project, Shanghai Municipal Science and Technology Commission*  
  Nov. 2022 – Nov. 2023  
  * Led development of ML-enhanced EM simulation methods.  
  * Achieved sub-1% modeling error for broadband multiport RF systems up to 100 GHz.  
  * Delivered over **200× speedup** compared with conventional EM simulation workflows.

* **Towards Real-Time Drone Detection on Embedded Platforms**  
  *3rd Place, DAC System Design Contest*  
  Nov. 2018 – Sept. 2019  
  * Optimized Tiny-YOLOv3 by reducing label-predicting channels.  
  * Deployed on NVIDIA Jetson TX2 with TensorRT, improving inference speed from 25 FPS to 47 FPS.


Teaching
======
* **Teaching Assistant**, UPenn–ShanghaiTech Joint Summer Camp, 2019  
* **Teaching Assistant**, ShanghaiTech University, 2019 – Present  
  * EE111L Electric Circuits Lab, Spring 2019  
  * EE213 Digital Integrated Circuits II, Fall 2021  
  * SI200 Academic Paper Writing, Spring 2022  

Skills
======
* **Languages:** Chinese (native), English  
* **Programming:** Python, C/C++, MATLAB, Verilog  
* **EDA / Simulation Tools:** Cadence Virtuoso, ADS, COMSOL, Ansys HFSS, PyTorch


Publications
======
  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
<!-- Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html  %}
  {% endfor %}</ul>
  
Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Service and leadership
======
* Currently signed in to 43 different slack teams -->
