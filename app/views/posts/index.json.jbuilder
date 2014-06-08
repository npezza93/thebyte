json.array!(@posts) do |post|
  json.extract! post, :id, :title, :subtitle, :author, :image, :content
  json.url post_url(post, format: :json)
end
