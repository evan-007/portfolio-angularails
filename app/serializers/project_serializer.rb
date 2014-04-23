class ProjectSerializer < ActiveModel::Serializer
	attributes :title, :description, :git, :link, :id, :image,
  :image_full, :image_thumb, :image_medium, :image_big, :tags, :lede
	has_many :tags

	def image_thumb
		object.image.url(:thumb)
	end

	def image_medium
		object.image.url(:medium)
	end

	def image_full
		object.image.url
	end
  
  def image_big
    object.image.url(:big)
  end

end