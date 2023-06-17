package main

import (
	"bytes"
	"fmt"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/gin-gonic/gin"
	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/chrome"
)

type KeywordConfig struct {
	Keyword string
	Title   string
	Tag     string
	Class   *regexp.Regexp
	ID      string
}

func main() {
	r := gin.Default()

	// 提供静态文件
	r.StaticFS("/static", http.Dir("assets"))

	// 提供 JavaScript 文件
	r.GET("/js/*filepath", func(c *gin.Context) {
		http.ServeFile(c.Writer, c.Request, "assets/js/"+c.Param("filepath"))
	})

	// 提供 Bootstrap CSS 文件
	r.GET("/css/*filepath", func(c *gin.Context) {
		http.ServeFile(c.Writer, c.Request, "assets/css/"+c.Param("filepath"))
	})

	// 提供页面
	r.GET("/", func(c *gin.Context) {
		data, err := Asset("assets/index.html")
		if err != nil {
			c.String(http.StatusNotFound, "404 page not found")
			return
		}

		// 设置响应头
		contentType := http.DetectContentType(data)
		c.Header("Content-Type", contentType)

		// 发送响应
		c.Data(http.StatusOK, contentType, data)
	})

	// 创建 HTTP API
	r.GET("/getPageContent", func(c *gin.Context) {

		// 获取一个未使用的端口号
		ln, err := net.Listen("tcp", ":0")
		if err != nil {
			fmt.Println(err)
			return
		}
		defer ln.Close()

		addr := ln.Addr().(*net.TCPAddr)

		fmt.Println(addr.Port)

		// 获取 URL 参数
		url := c.Query("url")

		// 设置允许跨域请求的源
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

		// 设置 ChromeDriver 选项
		chromeCaps := chrome.Capabilities{
			Args: []string{
				"--headless",
				"--disable-gpu",
				"--no-sandbox",
			},
			W3C: false, // 禁用 W3C 规范，允许使用非标准的 ChromeDriver 选项
		}
		caps := selenium.Capabilities{
			"chromeOptions": map[string]interface{}{
				"args": chromeCaps.Args,
				"w3c":  chromeCaps.W3C,
				"prefs": map[string]interface{}{
					"profile.managed_default_content_settings.images":      2, // 禁用图片加载
					"profile.default_content_setting_values.notifications": 2, // 禁用通知
				},
			},
		}

		// 启动 ChromeDriver
		service, err := selenium.NewChromeDriverService("chromedriver", addr.Port)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer service.Stop()

		// 连接到 ChromeDriver 实例
		wd, err := selenium.NewRemote(caps, fmt.Sprintf("http://localhost:%d/wd/hub", addr.Port))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer wd.Quit()

		// 定义关键字配置
		keywordConfigs := []KeywordConfig{
			{Keyword: "www.qutaojiao.com", Title: "h1", Tag: "div", Class: regexp.MustCompile("entry-content")},
			{Keyword: "cn.technode.com", Tag: "div", Class: regexp.MustCompile("post-content")},
			{Keyword: "www.profgalloway.com", Tag: "div", Class: regexp.MustCompile("blog-content")},
		}

		// 查找匹配的关键字配置
		var selectedConfig *KeywordConfig
		for _, config := range keywordConfigs {
			if strings.Contains(url, config.Keyword) {
				selectedConfig = &config
				break
			}
		}

		// 获取目标页面的内容
		if err := wd.Get(url); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		time.Sleep(2 * time.Second)
		content, err := wd.PageSource()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 解析 HTML 页面
		doc, err := goquery.NewDocumentFromReader(bytes.NewReader([]byte(content)))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 提取标题和正文内容
		var title, body bytes.Buffer
		foundTitle := false

		// 处理未找到关键字配置的情况
		if selectedConfig == nil {
			doc.Find("body *").Each(func(i int, s *goquery.Selection) {
				nodeName := s.Get(0).Data
				switch nodeName {
				case "p":
					body.WriteString(s.Text())
					body.WriteString("\n")
				case "img":
					if src, exists := s.Attr("src"); exists {
						body.WriteString(fmt.Sprintf("![Image](%s)\n", src))
					}
				default:
					class, _ := s.Attr("class")
					if containsKeyword(class, "article") || containsKeyword(class, "content") {
						body.WriteString(s.Text())
						body.WriteString("\n")
					}
				}
			})
		} else {
			// 提取正文内容
			var selectedTag, selectedClass string
			if selectedConfig != nil {
				selectedTag = selectedConfig.Tag
				selectedClass = selectedConfig.Class.String()
			} else {
				selectedTag = "article"
				selectedClass = "article|content" // 默认类名匹配的正则表达式
			}

			doc.Find(selectedTag).Each(func(i int, s *goquery.Selection) {
				class, exists := s.Attr("class")
				if exists && regexp.MustCompile(selectedClass).MatchString(class) {
					s.Find("*").Each(func(_ int, innerSel *goquery.Selection) {
						nodeName := innerSel.Get(0).Data
						switch nodeName {
						case "img":
							if src, exists := innerSel.Attr("src"); exists {
								body.WriteString(fmt.Sprintf("![Image](%s)\n", src))
							}
						default:
							body.WriteString(innerSel.Text())
							body.WriteString("\n")
						}
					})
				}
			})
		}

		// 提取标题
		if selectedConfig != nil && selectedConfig.Title != "" {
			doc.Find(selectedConfig.Title).Each(func(i int, s *goquery.Selection) {
				title.WriteString(s.Text())
				title.WriteString("\n")
				foundTitle = true
			})
		} else {
			doc.Find("title").Each(func(i int, s *goquery.Selection) {
				if !foundTitle {
					titleText := s.Text()

					// Regular expression to match either "-" or "|"
					re := regexp.MustCompile(`[-|]`)

					// Find the last occurrence of "-" or "|"
					indices := re.FindAllStringIndex(titleText, -1)
					if len(indices) > 0 {
						lastIdx := indices[len(indices)-1]
						titleText = strings.TrimSpace(titleText[:lastIdx[0]])
					}

					title.WriteString(titleText)
					title.WriteString("\n")
					foundTitle = true
				}
			})
		}

		// 返回标题和正文内容
		c.JSON(http.StatusOK, gin.H{
			"title": title.String(),
			"body":  body.String(),
		})
	})

	// 启动 HTTP API
	port := os.Getenv("PORT")
	if port == "" {
		port = "8888"
	}
	if err := r.Run(fmt.Sprintf(":%s", port)); err != nil {
		panic(err)
	}
}

// 检查字符串是否包含关键字
func containsKeyword(str, keyword string) bool {
	return str != "" && (str == keyword || contains(str, keyword+" ") || contains(str, " "+keyword) || contains(str, " "+keyword+" "))
}

// 检查字符串是否包含子字符串
func contains(str, substr string) bool {
	return len(str) >= len(substr) && str[:len(substr)] == substr
}
